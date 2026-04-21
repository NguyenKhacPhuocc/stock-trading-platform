import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { SystemConfig } from '../entities/system-config.entity';
import { User } from '../entities/user.entity';
import { CustomerProfile } from '../entities/customer-profile.entity';
import { TradingAccount } from '../entities/trading-account.entity';
import {
  UserRole,
  KycStatus,
  TradingAccountStatus,
  TradingAccountType,
  TradingAccountChannel,
  DEFAULT_ORG_CODE,
  ConfigKey,
} from '../../common/const';
import { Wallet } from '../entities/wallet.entity';

function buildCustId(orgCode: string, kind: 'C' | 'A', seq: number): string {
  return `${orgCode}${kind}${String(seq).padStart(6, '0')}`.toUpperCase();
}

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(SystemConfig)
    private configRepo: Repository<SystemConfig>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(CustomerProfile)
    private profileRepo: Repository<CustomerProfile>,
    @InjectRepository(TradingAccount)
    private accountRepo: Repository<TradingAccount>,
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedConfigs();
    await this.seedDefaultUsers();
  }

  private async seedConfigs() {
    const defaults: Array<{ key: string; value: string; description: string }> =
      [
        {
          key: ConfigKey.BROKER_ORG_CODE,
          value: DEFAULT_ORG_CODE,
          description: 'Mã tổ chức — prefix cust_id / account_id',
        },
        {
          key: ConfigKey.BROKER_SEQ_CUSTOMER,
          value: '2',
          description: 'Sequence tiếp theo cho cust_id khách (C)',
        },
        {
          key: ConfigKey.BROKER_SEQ_ADMIN,
          value: '2',
          description: 'Sequence tiếp theo cho cust_id admin (A)',
        },
      ];

    for (const cfg of defaults) {
      const exists = await this.configRepo.findOne({ where: { key: cfg.key } });
      if (!exists) {
        await this.configRepo.save(this.configRepo.create(cfg));
        this.logger.log(`Seed config: ${cfg.key} = ${cfg.value}`);
      }
    }
  }

  private async seedDefaultUsers() {
    await this.ensureUser({
      custId: buildCustId(DEFAULT_ORG_CODE, 'C', 1),
      password: '123123',
      fullName: 'Khách hàng mặc định',
      role: UserRole.USER,
      nationalIdNumber: '001099000001',
    });

    await this.ensureUser({
      custId: buildCustId(DEFAULT_ORG_CODE, 'A', 1),
      password: '123123',
      fullName: 'Quản trị viên',
      role: UserRole.ADMIN,
      nationalIdNumber: null,
    });
  }

  private async ensureUser(opts: {
    custId: string;
    password: string;
    fullName: string;
    role: UserRole;
    nationalIdNumber: string | null;
  }) {
    const existing = await this.userRepo.findOne({
      where: { custId: opts.custId },
    });
    if (existing) return;

    const passwordHash = await bcrypt.hash(opts.password, 10);

    const user = await this.userRepo.save(
      this.userRepo.create({
        custId: opts.custId,
        passwordHash,
        fullName: opts.fullName,
        role: opts.role,
        isActive: true,
      }),
    );

    await this.profileRepo.save(
      this.profileRepo.create({
        userId: user.id,
        nationalIdNumber: opts.nationalIdNumber,
        kycStatus: opts.nationalIdNumber
          ? KycStatus.SIMULATED_VERIFIED
          : KycStatus.PENDING,
      }),
    );

    const defaultAccountId = `${opts.custId}.1`;
    const account = await this.accountRepo.save(
      this.accountRepo.create({
        userId: user.id,
        accountId: defaultAccountId,
        accountType: TradingAccountType.CASH,
        tradingChannel: TradingAccountChannel.STOCK,
        status: TradingAccountStatus.ACTIVE,
        isDefault: true,
      }),
    );

    await this.walletRepo.save(
      this.walletRepo.create({
        tradingAccountId: account.id,
        availableBalance: 0,
        lockedBalance: 0,
      }),
    );

    // eslint-disable-next-line prettier/prettier
    this.logger.log(`Seed user: ${opts.custId} / TK ${defaultAccountId} (${opts.role})`);
  }
}
