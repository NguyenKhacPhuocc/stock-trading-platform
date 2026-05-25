import { BadRequestException, Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../database/entities/user.entity';
import { TradingAccount } from '../../database/entities/trading-account.entity';
import { CustomerProfile } from '../../database/entities/customer-profile.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { tradingAccountStatusToApi } from '../../common/const';
import { AuditAction } from '../../common/const/audit-actions';
import { isIdentityLocked, KYC_STATUS_LABEL_VI, KycStatus } from '../../common/const/kyc-status';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SetupTradingPinDto } from './dto/setup-trading-pin.dto';
import { ChangeTradingPinDto } from './dto/change-trading-pin.dto';
import { BusinessException } from '../../common/errors/business.exception';
import {
  loginChannelFromUserAgent,
  loginChannelLabel,
  normalizeDisplayIp,
} from '../../common/utils/request-client.util';
import { toUtcIsoString, vnDateRangeToUtcBounds } from '../../common/utils/vn-time.util';

export type UserProfileResponse = {
  id: string;
  custId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  identity: {
    nationalIdNumber: string | null;
    dateOfBirth: string | null;
    address: string | null;
    kycStatus: KycStatus;
    kycStatusLabel: string;
  };
  editable: {
    fullName: boolean;
    phone: boolean;
    email: boolean;
  };
  /** Khi bật OTP: FE gửi mã + backend verify trước khi ghi phone/email. */
  verification: {
    phoneOtpRequired: boolean;
    emailOtpRequired: boolean;
  };
  createdAt?: Date;
  updatedAt?: Date;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(TradingAccount)
    private accountRepo: Repository<TradingAccount>,
    @InjectRepository(CustomerProfile)
    private profileRepo: Repository<CustomerProfile>,
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
  ) {}

  private async writeAudit(params: {
    actorUserId: string;
    action: string;
    entityType?: string;
    entityId?: string;
    payloadBefore?: Record<string, unknown> | null;
    payloadAfter?: Record<string, unknown> | null;
    ipAddress?: string | null;
  }) {
    await this.auditRepo.save(
      this.auditRepo.create({
        actorUserId: params.actorUserId,
        action: params.action,
        entityType: params.entityType ?? 'user',
        entityId: params.entityId ?? params.actorUserId,
        payloadBefore: params.payloadBefore ?? null,
        payloadAfter: params.payloadAfter ?? null,
        ipAddress: params.ipAddress ?? null,
      }),
    );
  }

  private contactSnapshot(user: Pick<User, 'phone' | 'email' | 'fullName'>) {
    return {
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
    };
  }

  /** Danh sách tiểu khoản — `id` = mã tiểu khoản (account_id); thêm `tradingAccountId` = UUID nội bộ. */
  async listMyTradingAccounts(userId: string) {
    const rows = await this.accountRepo.find({
      where: { userId },
      order: { accountId: 'ASC' },
    });
    return {
      accounts: rows.map((r) => ({
        tradingAccountId: r.id,
        id: r.accountId,
        type: r.accountType,
        channel: r.tradingChannel,
        status: tradingAccountStatusToApi(r.status),
        isDefault: r.isDefault,
      })),
    };
  }

  private mapProfileResponse(
    user: Pick<User, 'id' | 'custId' | 'fullName' | 'phone' | 'email' | 'createdAt'>,
    profile: CustomerProfile | null,
    updatedAt?: Date,
  ): UserProfileResponse {
    const kycStatus = profile?.kycStatus ?? KycStatus.PENDING;
    const nationalIdNumber = profile?.nationalIdNumber ?? null;
    const identityLocked = isIdentityLocked(kycStatus, nationalIdNumber);

    return {
      id: user.id,
      custId: user.custId,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      identity: {
        nationalIdNumber,
        dateOfBirth: profile?.dateOfBirth ?? null,
        address: profile?.address ?? null,
        kycStatus,
        kycStatusLabel: KYC_STATUS_LABEL_VI[kycStatus],
      },
      editable: {
        fullName: !identityLocked,
        phone: true,
        email: true,
      },
      verification: {
        phoneOtpRequired: false,
        emailOtpRequired: false,
      },
      createdAt: user.createdAt,
      updatedAt,
    };
  }

  /** Hook OTP liên hệ — hiện no-op; sau này verify contactOtpPhone / contactOtpEmail. */
  private async verifyContactChangeOtp(
    _userId: string,
    _dto: UpdateProfileDto,
  ): Promise<void> {
    // TODO: if (phone/email changed) require OTP token valid for userId
  }

  private async assertEmailAvailable(
    userId: string,
    email: string | null,
  ): Promise<void> {
    if (!email) return;
    const normalized = email.toLowerCase();
    const existing = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id'])
      .where('LOWER(u.email) = :email', { email: normalized })
      .getOne();
    if (existing && existing.id !== userId) {
      throw new BusinessException('EMAIL_ALREADY_IN_USE');
    }
  }

  async getProfile(userId: string): Promise<UserProfileResponse | null> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'custId', 'email', 'fullName', 'phone', 'createdAt'],
    });
    if (!user) return null;

    const profile = await this.profileRepo.findOne({ where: { userId } });
    return this.mapProfileResponse(user, profile, profile?.updatedAt);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'custId', 'email', 'fullName', 'phone', 'createdAt'],
    });
    if (!user) {
      throw new BusinessException(
        'AUTH_INVALID_TOKEN',
        undefined,
        HttpStatus.UNAUTHORIZED,
      );
    }

    const profile = await this.profileRepo.findOne({ where: { userId } });
    const identityLocked = isIdentityLocked(
      profile?.kycStatus ?? KycStatus.PENDING,
      profile?.nationalIdNumber,
    );

    if (dto.fullName !== undefined && identityLocked) {
      throw new BusinessException('PROFILE_IDENTITY_LOCKED');
    }

    await this.verifyContactChangeOtp(userId, dto);

    const patch: Partial<Pick<User, 'fullName' | 'phone' | 'email'>> = {};
    if (dto.fullName !== undefined) patch.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) {
      patch.phone = dto.phone.trim() ? dto.phone.trim() : null;
    }
    if (dto.email !== undefined) {
      const trimmed = dto.email.trim();
      patch.email = trimmed ? trimmed.toLowerCase() : null;
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Cần ít nhất một trường cập nhật');
    }

    if (patch.email !== undefined) {
      await this.assertEmailAvailable(userId, patch.email);
    }

    const beforeContact = this.contactSnapshot(user);

    await this.userRepo.update(userId, patch);

    const updated = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'custId', 'email', 'fullName', 'phone', 'createdAt'],
    });
    if (!updated) {
      throw new BusinessException(
        'AUTH_INVALID_TOKEN',
        undefined,
        HttpStatus.UNAUTHORIZED,
      );
    }

    const profileAfter = await this.profileRepo.findOne({ where: { userId } });
    await this.writeAudit({
      actorUserId: userId,
      action: AuditAction.USER_PROFILE_UPDATE,
      payloadBefore: beforeContact,
      payloadAfter: this.contactSnapshot(updated),
    });
    return this.mapProfileResponse(
      updated,
      profileAfter,
      profileAfter?.updatedAt ?? new Date(),
    );
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new BusinessException(
        'AUTH_INVALID_TOKEN',
        undefined,
        HttpStatus.UNAUTHORIZED,
      );
    }
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new BusinessException('CURRENT_PASSWORD_INVALID');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepo.update(userId, { passwordHash: newHash });
    await this.writeAudit({
      actorUserId: userId,
      action: AuditAction.USER_PASSWORD_CHANGE,
      payloadAfter: { at: new Date().toISOString() },
    });
    return { message: 'Đổi mật khẩu thành công' };
  }

  /** Thiết lập PIN lần đầu — không cho ghi đè khi đã có PIN. */
  async setupTradingPin(userId: string, dto: SetupTradingPinDto) {
    if (dto.pin !== dto.confirmPin) {
      throw new BusinessException('TRADING_PIN_MISMATCH');
    }

    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'tradingPinHash'],
    });
    if (!user) {
      throw new BusinessException(
        'AUTH_INVALID_TOKEN',
        undefined,
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (user.tradingPinHash) {
      throw new BusinessException('TRADING_PIN_ALREADY_SET');
    }

    const tradingPinHash = await bcrypt.hash(dto.pin, 10);
    await this.userRepo.update(userId, { tradingPinHash });
    await this.writeAudit({
      actorUserId: userId,
      action: AuditAction.USER_PIN_CHANGE,
      payloadAfter: { type: 'setup' },
    });
    return { hasTradingPin: true };
  }

  async changeTradingPin(userId: string, dto: ChangeTradingPinDto) {
    if (dto.pin !== dto.confirmPin) {
      throw new BusinessException('TRADING_PIN_MISMATCH');
    }

    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'tradingPinHash'],
    });
    if (!user) {
      throw new BusinessException(
        'AUTH_INVALID_TOKEN',
        undefined,
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (!user.tradingPinHash) {
      throw new BusinessException('TRADING_PIN_NOT_SET');
    }

    const valid = await bcrypt.compare(dto.currentPin, user.tradingPinHash);
    if (!valid) {
      throw new BusinessException('TRADING_PIN_INVALID');
    }

    const tradingPinHash = await bcrypt.hash(dto.pin, 10);
    await this.userRepo.update(userId, { tradingPinHash });
    await this.writeAudit({
      actorUserId: userId,
      action: AuditAction.USER_PIN_CHANGE,
      payloadAfter: { type: 'change' },
    });
    return { hasTradingPin: true };
  }

  async listLoginHistory(
    userId: string,
    from?: string,
    to?: string,
  ): Promise<
    {
      id: string;
      loginAt: string;
      ipAddress: string | null;
      channel: string;
    }[]
  > {
    const where: Record<string, unknown> = {
      actorUserId: userId,
      action: AuditAction.USER_LOGIN,
    };
    const range = vnDateRangeToUtcBounds(from, to);
    if (range.start && range.end) {
      where.createdAt = Between(range.start, range.end);
    } else if (range.start) {
      where.createdAt = MoreThanOrEqual(range.start);
    } else if (range.end) {
      where.createdAt = LessThanOrEqual(range.end);
    }

    const rows = await this.auditRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 200,
    });

    return rows.map((r) => {
      const after = r.payloadAfter as {
        userAgent?: string;
        channel?: string;
        loginAtUtc?: string;
      } | null;
      const channel =
        after?.channel === 'app' || after?.channel === 'web'
          ? loginChannelLabel(after.channel as 'web' | 'app')
          : loginChannelLabel(loginChannelFromUserAgent(after?.userAgent ?? null));
      const loginAt =
        typeof after?.loginAtUtc === 'string' && after.loginAtUtc
          ? after.loginAtUtc
          : toUtcIsoString(r.createdAt);
      return {
        id: r.id,
        loginAt,
        ipAddress: normalizeDisplayIp(r.ipAddress),
        channel,
      };
    });
  }

  async listProfileChangeHistory(
    userId: string,
    from?: string,
    to?: string,
  ): Promise<
    {
      id: string;
      changedAt: string;
      before: Record<string, unknown> | null;
      after: Record<string, unknown> | null;
    }[]
  > {
    const where: Record<string, unknown> = {
      actorUserId: userId,
      action: AuditAction.USER_PROFILE_UPDATE,
    };
    const range = vnDateRangeToUtcBounds(from, to);
    if (range.start && range.end) {
      where.createdAt = Between(range.start, range.end);
    } else if (range.start) {
      where.createdAt = MoreThanOrEqual(range.start);
    } else if (range.end) {
      where.createdAt = LessThanOrEqual(range.end);
    }

    const rows = await this.auditRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 200,
    });

    return rows.map((r) => ({
      id: r.id,
      changedAt: toUtcIsoString(r.createdAt),
      before: r.payloadBefore,
      after: r.payloadAfter,
    }));
  }
}
