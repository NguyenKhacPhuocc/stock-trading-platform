import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Stock } from '../../database/entities/stock.entity';
import { CreateStockDto } from './dto/create-stock.dto';
import { MarketService } from '../market/market.service';
import { DEFAULT_STOCK_BOARD_ID } from '../../common/const';

@Injectable()
export class StocksService {
  private readonly logger = new Logger(StocksService.name);

  constructor(
    @InjectRepository(Stock) private stockRepo: Repository<Stock>,
    private market: MarketService,
  ) {}

  async create(dto: CreateStockDto) {
    const symbol = dto.symbol.trim().toUpperCase();
    const boardId =
      dto.boardId != null && dto.boardId !== ''
        ? dto.boardId.trim()
        : DEFAULT_STOCK_BOARD_ID;
    const existing = await this.stockRepo.findOne({
      where: { symbol, boardId },
    });
    if (existing) {
      throw new ConflictException(`Mã ${symbol} đã tồn tại`);
    }

    const ceilPct = dto.ceilPct ?? 7;
    const floorPct = dto.floorPct ?? ceilPct;

    const stock = this.stockRepo.create({
      symbol,
      boardId,
      name: dto.name.trim(),
      exchange: dto.exchange,
      ceilPct,
      floorPct,
      tickSize: dto.tickSize ?? 100,
      lotSize: dto.lotSize ?? 100,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.stockRepo.save(stock);
    void this.market.refreshBoardForStock(saved.id).catch((e: unknown) => {
      this.logger.warn(`refreshBoardForStock: ${String(e)}`);
    });
    return saved;
  }

  findAll() {
    return this.stockRepo.find({
      where: { isActive: true, boardId: DEFAULT_STOCK_BOARD_ID },
      order: { symbol: 'ASC' },
    });
  }

  async findBySymbol(symbol: string, boardId = DEFAULT_STOCK_BOARD_ID) {
    const stock = await this.stockRepo.findOne({
      where: { symbol: symbol.toUpperCase(), boardId },
    });
    if (!stock) throw new NotFoundException(`Không tìm thấy mã ${symbol}`);
    return stock;
  }
}
