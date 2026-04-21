import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../database/entities/user.entity';
import { TradingAccount } from '../../database/entities/trading-account.entity';
import { tradingAccountStatusToApi } from '../../common/const';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(TradingAccount)
    private accountRepo: Repository<TradingAccount>,
  ) {}

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

  async getProfile(userId: string) {
    return this.userRepo.findOne({
      where: { id: userId },
      select: [
        'id',
        'custId',
        'email',
        'fullName',
        'phone',
        'role',
        'createdAt',
      ],
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.userRepo.update(userId, dto);
    return this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'custId', 'fullName', 'phone', 'email', 'updatedAt'],
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const valid = await bcrypt.compare(dto.currentPassword, user!.passwordHash);
    if (!valid) throw new BadRequestException('Mật khẩu hiện tại không đúng');

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepo.update(userId, { passwordHash: newHash });
    return { message: 'Đổi mật khẩu thành công' };
  }
}
