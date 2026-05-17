import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
import { Position } from '../entities/position.entity';
import { WalletService } from '../../modules/wallet/wallet.service';

function buildCustId(orgCode: string, kind: 'C' | 'A', seq: number): string {
  return `${orgCode}${kind}${String(seq).padStart(6, '0')}`.toUpperCase();
}

const SEED_CUST_IDS = [
  buildCustId(DEFAULT_ORG_CODE, 'C', 1),
  buildCustId(DEFAULT_ORG_CODE, 'A', 1),
] as const;

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
    @InjectRepository(Position) private positionRepo: Repository<Position>,
    private readonly dataSource: DataSource,
    private readonly walletService: WalletService,
  ) {}

  async onApplicationBootstrap() {
    await this.seedConfigs();
    await this.seedDefaultUsers();
    await this.backfillSeedAccountGifts();
    await this.normalizePositionAvailableQuantities();
  }

  /** Dữ liệu cũ: quantity = tổng; chuẩn mới: quantity = khả dụng (= tổng − locked). */
  private async normalizePositionAvailableQuantities(): Promise<void> {
    const rows = await this.positionRepo.find({ where: {} });
    for (const p of rows) {
      const locked = Number(p.lockedQuantity);
      if (locked <= 0) continue;
      const qty = Number(p.quantity);
      if (qty > locked) {
        p.quantity = qty - locked;
        await this.positionRepo.save(p);
        this.logger.log(
          `Chuẩn hóa position ${p.id}: available=${p.quantity}, locked=${locked}`,
        );
      }
    }
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
      custId: SEED_CUST_IDS[0],
      password: '123123',
      fullName: 'Khách hàng mặc định',
      role: UserRole.USER,
      nationalIdNumber: '001099000001',
    });

    await this.ensureUser({
      custId: SEED_CUST_IDS[1],
      password: '123123',
      fullName: 'Quản trị viên',
      role: UserRole.ADMIN,
      nationalIdNumber: null,
    });
  }

  /** TK seed đã tạo trước đó (số dư 0) — bổ sung quà khi restart. */
  private async backfillSeedAccountGifts() {
    for (const custId of SEED_CUST_IDS) {
      const user = await this.userRepo.findOne({ where: { custId } });
      if (!user) continue;

      const account = await this.accountRepo.findOne({
        where: { userId: user.id, isDefault: true },
      });
      if (!account) continue;

      const wallet = await this.walletRepo.findOne({
        where: { tradingAccountId: account.id },
      });
      if (!wallet) continue;

      await this.dataSource.transaction(async (manager) => {
        const managedWallet = await manager.findOne(Wallet, {
          where: { id: wallet.id },
        });
        if (!managedWallet) return;
        await this.walletService.backfillGiftIfNeeded(manager, managedWallet);
      });
    }
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
    const initialBalance = this.walletService.getInitialWalletBalance();

    await this.dataSource.transaction(async (manager) => {
      const user = await manager.save(
        manager.create(User, {
          custId: opts.custId,
          passwordHash,
          fullName: opts.fullName,
          role: opts.role,
          isActive: true,
        }),
      );

      await manager.save(
        manager.create(CustomerProfile, {
          userId: user.id,
          nationalIdNumber: opts.nationalIdNumber,
          kycStatus: opts.nationalIdNumber
            ? KycStatus.SIMULATED_VERIFIED
            : KycStatus.PENDING,
        }),
      );

      const defaultAccountId = `${opts.custId}.1`;
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

      const wallet = await manager.save(
        manager.create(Wallet, {
          tradingAccountId: account.id,
          availableBalance: initialBalance,
          lockedBalance: 0,
        }),
      );

      await this.walletService.applyNewAccountGift(
        manager,
        wallet,
        initialBalance,
        { throwIfStockMissing: false },
      );
    });

    this.logger.log(
      `Seed user: ${opts.custId} / TK ${opts.custId}.1 (${opts.role}) — ${initialBalance} VND + quà cổ phiếu`,
    );
  }
}
