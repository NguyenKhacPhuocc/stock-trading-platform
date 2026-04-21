import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../database/entities/order.entity';
import { OrderType, OrderStatus } from '../../common/const';
import { Stock } from '../../database/entities/stock.entity';
import { PriceHistory } from '../../database/entities/price-history.entity';
import { TradingAccount } from '../../database/entities/trading-account.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { MarketService } from '../market/market.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(Stock) private stockRepo: Repository<Stock>,
    @InjectRepository(PriceHistory) private priceRepo: Repository<PriceHistory>,
    @InjectRepository(TradingAccount)
    private accountRepo: Repository<TradingAccount>,
    private market: MarketService,
  ) {}

  private async getDefaultAccount(userId: string): Promise<TradingAccount> {
    const account = await this.accountRepo.findOne({
      where: { userId, isDefault: true },
    });
    if (!account)
      throw new NotFoundException('Không tìm thấy tài khoản giao dịch');
    return account;
  }

  async createOrder(userId: string, dto: CreateOrderDto) {
    const account = await this.getDefaultAccount(userId);

    if (dto.quantity % 100 !== 0) {
      throw new BadRequestException(
        'Số lượng phải là bội số của 100 (lô chẵn)',
      );
    }
    if (dto.orderType === OrderType.LO && !dto.price) {
      throw new BadRequestException('Lệnh LO cần có giá đặt');
    }

    const stock = await this.stockRepo.findOne({ where: { id: dto.stockId } });
    if (!stock) throw new BadRequestException('Mã chứng khoán không tồn tại');

    if (dto.orderType === OrderType.LO && dto.price) {
      await this.checkAmplitude(stock, dto.price);
    }

    const order = this.orderRepo.create({
      tradingAccountId: account.id,
      stockId: dto.stockId,
      side: dto.side,
      orderType: dto.orderType,
      price: dto.price ?? null,
      quantity: dto.quantity,
    });
    const saved = await this.orderRepo.save(order);
    void this.market.refreshBoardForStock(saved.stockId).catch((e: unknown) => {
      this.logger.warn(`refreshBoardForStock: ${String(e)}`);
    });
    return saved;
  }

  async getUserOrders(userId: string) {
    const account = await this.getDefaultAccount(userId);
    return this.orderRepo.find({
      where: { tradingAccountId: account.id },
      relations: { stock: true },
      order: { createdAt: 'DESC' },
    });
  }

  async cancelOrder(userId: string, orderId: string) {
    const account = await this.getDefaultAccount(userId);
    const order = await this.orderRepo.findOne({
      where: {
        id: orderId,
        tradingAccountId: account.id,
        status: OrderStatus.PENDING,
      },
    });
    if (!order) throw new BadRequestException('Không thể hủy lệnh này');

    order.status = OrderStatus.CANCELLED;
    order.cancelledAt = new Date();
    const saved = await this.orderRepo.save(order);
    void this.market.refreshBoardForStock(saved.stockId).catch((e: unknown) => {
      this.logger.warn(`refreshBoardForStock: ${String(e)}`);
    });
    return saved;
  }

  private async checkAmplitude(stock: Stock, price: number) {
    const last = await this.priceRepo.findOne({
      where: { stockId: stock.id },
      order: { date: 'DESC' },
    });
    if (!last) return;

    const ref = Number(last.close);
    const pct = Number(stock.ceilPct) / 100;
    if (price > ref * (1 + pct) || price < ref * (1 - pct)) {
      throw new BadRequestException(
        `Giá nằm ngoài biên độ (${(ref * (1 - pct)).toFixed(0)} – ${(ref * (1 + pct)).toFixed(0)})`,
      );
    }
  }
}
