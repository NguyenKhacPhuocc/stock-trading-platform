import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, MoreThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '../../database/entities/user.entity';
import { CustomerProfile } from '../../database/entities/customer-profile.entity';
import { TradingAccount } from '../../database/entities/trading-account.entity';
import {
  UserRole,
  KycStatus,
  TradingAccountStatus,
  TradingAccountType,
  TradingAccountChannel,
  DEFAULT_ORG_CODE,
  ConfigKey,
} from '../../common/const';
import { Wallet } from '../../database/entities/wallet.entity';
import { SystemConfig } from '../../database/entities/system-config.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  generateOpaqueRefreshToken,
  hashRefreshToken,
  ttlToMs,
} from './auth-token.util';
import type { AuthTokensPayload } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(CustomerProfile)
    private profileRepo: Repository<CustomerProfile>,
    @InjectRepository(TradingAccount)
    private accountRepo: Repository<TradingAccount>,
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
    @InjectRepository(SystemConfig)
    private configRepo: Repository<SystemConfig>,
    @InjectRepository(RefreshToken)
    private refreshRepo: Repository<RefreshToken>,
    private jwt: JwtService,
    private dataSource: DataSource,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const profileDateOfBirth: string | null = dto.dateOfBirth ?? null;
    const addr = dto.address;
    const profileAddress: string | null =
      typeof addr === 'string' && addr.trim().length > 0 ? addr.trim() : null;

    return this.dataSource
      .transaction(async (manager) => {
        const orgCode = await this.getConfigValue(
          ConfigKey.BROKER_ORG_CODE,
          DEFAULT_ORG_CODE,
        );
        const seqRow = await manager.findOne(SystemConfig, {
          where: { key: ConfigKey.BROKER_SEQ_CUSTOMER },
        });
        const seq = seqRow ? parseInt(seqRow.value, 10) : 1;
        const custId =
          `${orgCode}C${String(seq).padStart(6, '0')}`.toUpperCase();

        const existing = await manager.findOne(User, { where: { custId } });
        if (existing) {
          throw new ConflictException('custId đã tồn tại, vui lòng thử lại.');
        }

        const passwordHash = await bcrypt.hash(dto.password, 10);

        const user = await manager.save(
          manager.create(User, {
            custId,
            passwordHash,
            fullName: dto.fullName,
            email: dto.email ?? null,
            phone: dto.phone ?? null,
            role: UserRole.USER,
            isActive: true,
          }),
        );

        await manager.save(
          manager.create(CustomerProfile, {
            userId: user.id,
            nationalIdNumber: dto.nationalIdNumber ?? null,
            kycStatus: dto.nationalIdNumber
              ? KycStatus.SIMULATED_VERIFIED
              : KycStatus.PENDING,
            dateOfBirth: profileDateOfBirth,
            address: profileAddress,
          }),
        );

        const defaultAccountId = `${custId}.1`;
        const account = await manager.save(
          manager.create(TradingAccount, {
            userId: user.id,
            accountId: defaultAccountId,
            accountType: TradingAccountType.CASH,
            tradingChannel: TradingAccountChannel.STOCK,
            status: TradingAccountStatus.ACTIVE,
            isDefault: true,
          }),
        );

        await manager.save(
          manager.create(Wallet, {
            tradingAccountId: account.id,
            availableBalance: 0,
            lockedBalance: 0,
          }),
        );

        if (seqRow) {
          await manager.update(
            SystemConfig,
            { key: ConfigKey.BROKER_SEQ_CUSTOMER },
            { value: String(seq + 1) },
          );
        } else {
          await manager.save(
            manager.create(SystemConfig, {
              key: ConfigKey.BROKER_SEQ_CUSTOMER,
              value: String(seq + 1),
            }),
          );
        }

        return {
          custId,
          defaultAccountId,
          fullName: user.fullName,
          role: user.role,
        };
      })
      .catch((err: unknown) => {
        if (err instanceof ConflictException) throw err;
        throw new InternalServerErrorException(
          'Đăng ký thất bại, vui lòng thử lại',
        );
      });
  }

  async login(dto: LoginDto): Promise<AuthTokensPayload> {
    const custId = dto.custId.trim().toUpperCase();
    const user = await this.userRepo.findOne({ where: { custId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Mã đăng nhập hoặc mật khẩu không đúng');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Mã đăng nhập hoặc mật khẩu không đúng');
    }

    return this.issueTokensForUser(user);
  }

  /** Payload /auth/me — chỉ user; FE gọi GET /users/me/accounts cho tiểu khoản */
  getSessionForUser(user: User) {
    return {
      user: {
        id: user.id,
        custId: user.custId,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    };
  }

  /** Tạo access JWT ngắn hạn + refresh opaque (lưu hash DB), rotation-safe */
  async issueTokensForUser(user: User): Promise<AuthTokensPayload> {
    const refreshTtl =
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    const accessToken = this.jwt.sign({
      sub: user.id,
      custId: user.custId,
      role: user.role,
    });

    const plainRefresh = generateOpaqueRefreshToken();
    const tokenHash = hashRefreshToken(plainRefresh);
    const expiresAt = new Date(Date.now() + ttlToMs(refreshTtl));

    await this.refreshRepo.save(
      this.refreshRepo.create({
        userId: user.id,
        tokenHash,
        expiresAt,
        revokedAt: null,
      }),
    );

    return {
      accessToken,
      refreshToken: plainRefresh,
      user: {
        id: user.id,
        custId: user.custId,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    };
  }

  /** Đổi refresh (rotation): revoke bản ghi cũ, cấp cặp access + refresh mới */
  async rotateRefreshPair(plainRefresh: string): Promise<AuthTokensPayload> {
    const tokenHash = hashRefreshToken(plainRefresh);
    const row = await this.refreshRepo.findOne({
      where: {
        tokenHash,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      relations: ['user'],
    });

    if (!row?.user?.isActive) {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }

    const user = row.user;

    await this.refreshRepo.update({ id: row.id }, { revokedAt: new Date() });

    return this.issueTokensForUser(user);
  }

  async revokeRefreshToken(plainRefresh: string | undefined): Promise<void> {
    if (!plainRefresh?.trim()) return;
    const tokenHash = hashRefreshToken(plainRefresh.trim());
    await this.refreshRepo.update(
      { tokenHash, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async getConfigValue(key: string, fallback: string): Promise<string> {
    const row = await this.configRepo.findOne({ where: { key } });
    return row?.value ?? fallback;
  }
}
