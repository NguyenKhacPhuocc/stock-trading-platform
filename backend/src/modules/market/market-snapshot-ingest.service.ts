import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Stock } from '../../database/entities/stock.entity';
import { StockBoardSnapshot } from '../../database/entities/stock-board-snapshot.entity';
import { MarketSnapshotIngest } from '../../database/entities/market-snapshot-ingest.entity';
import {
  DEFAULT_STOCK_BOARD_ID,
  Exchange,
  CACHE_TTL_MARKET_QUOTES,
  MarketSnapshotIngestStatus,
  MarketSnapshotSource,
  marketQuotesCacheKey,
} from '../../common/const';
import { toNum } from './market-price.util';
import { RedisService } from '../../redis/redis.service';

type SsiExchangePath = 'hose' | 'hnx' | 'upcom';

interface SsiSymbol {
  boardId?: string;
  isin?: string;
  companyNameVi?: string;
  companyNameEn?: string;
  exchange?: string;
  stockSymbol?: string;
  refPrice?: number | string;
  ceiling?: number | string;
  floor?: number | string;
  openPrice?: number | string;
  highest?: number | string;
  lowest?: number | string;
  matchedPrice?: number | string;
  matchedVolume?: number | string;
  stockVol?: number | string;
  nmTotalTradedQty?: number | string;
  nmTotalTradedValue?: number | string;
  best1Bid?: number | string;
  best2Bid?: number | string;
  best3Bid?: number | string;
  best1BidVol?: number | string;
  best2BidVol?: number | string;
  best3BidVol?: number | string;
  best1Offer?: number | string;
  best2Offer?: number | string;
  best3Offer?: number | string;
  best1OfferVol?: number | string;
  best2OfferVol?: number | string;
  best3OfferVol?: number | string;
  session?: string;
  exchangeSession?: string;
  priceChange?: number | string;
  priceChangePercent?: number | string;
  tradingDate?: string;
  tradingUnit?: number | string;
}

interface SsiResponseLike {
  data?: unknown;
  items?: unknown;
}

export interface IngestRunResult {
  skipped: boolean;
  tradingDate: string;
  symbolsUpserted: number;
  message: string;
}

type RawPayloadQuery = QueryDeepPartialEntity<Record<string, unknown> | null>;

@Injectable()
export class MarketSnapshotIngestService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MarketSnapshotIngestService.name);

  constructor(
    @InjectRepository(Stock) private readonly stockRepo: Repository<Stock>,
    @InjectRepository(StockBoardSnapshot)
    private readonly snapshotRepo: Repository<StockBoardSnapshot>,
    @InjectRepository(MarketSnapshotIngest)
    private readonly ingestRepo: Repository<MarketSnapshotIngest>,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.runStartupIngest();
  }

  async forceRefreshToday(): Promise<IngestRunResult> {
    return this.runStartupIngest(true);
  }

  private async runStartupIngest(force = false): Promise<IngestRunResult> {
    const tradingDate = this.tradingDateYmdVN();
    const skipIfSuccess =
      this.config.get<string>('MARKET_INGEST_SKIP_IF_SUCCESS', 'true') !==
      'false';

    if (!force && skipIfSuccess) {
      const existedSuccess = await this.ingestRepo.exist({
        where: {
          tradingDate,
          source: MarketSnapshotSource.SSI,
          status: MarketSnapshotIngestStatus.SUCCESS,
        },
      });
      if (existedSuccess) {
        await this.refreshQuotesCache(tradingDate);
        const message = `Skip SSI ingest: đã có SUCCESS cho ngày ${tradingDate}.`;
        this.logger.log(message);
        return {
          skipped: true,
          tradingDate,
          symbolsUpserted: 0,
          message,
        };
      }
    }

    const ingest = await this.ingestRepo.save(
      this.ingestRepo.create({
        tradingDate,
        source: MarketSnapshotSource.SSI,
        status: MarketSnapshotIngestStatus.PENDING,
        startedAt: new Date(),
        finishedAt: null,
        errorMessage: null,
        symbolsUpserted: null,
      }),
    );

    try {
      const rows = await this.fetchAllExchanges();
      if (rows.length === 0) {
        throw new Error('SSI trả về danh sách rỗng cho tất cả sàn.');
      }

      const mappedTradingDate = this.resolveTradingDate(rows, tradingDate);
      const symbolsUpserted = await this.upsertDailySeed(
        rows,
        mappedTradingDate,
      );
      await this.refreshQuotesCache(mappedTradingDate);

      await this.ingestRepo.update(ingest.id, {
        status: MarketSnapshotIngestStatus.SUCCESS,
        finishedAt: new Date(),
        symbolsUpserted,
        errorMessage: null,
      });
      const message = `SSI ingest SUCCESS ${mappedTradingDate}: ${symbolsUpserted} mã.`;
      this.logger.log(message);
      return {
        skipped: false,
        tradingDate: mappedTradingDate,
        symbolsUpserted,
        message,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await this.ingestRepo.update(ingest.id, {
        status: MarketSnapshotIngestStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: message,
      });
      this.logger.error(`SSI ingest FAILED (${tradingDate}): ${message}`);
      return {
        skipped: false,
        tradingDate,
        symbolsUpserted: 0,
        message,
      };
    }
  }

  private async fetchAllExchanges(): Promise<SsiSymbol[]> {
    const boardId = this.config.get<string>(
      'SSI_SNAPSHOT_BOARD_ID',
      DEFAULT_STOCK_BOARD_ID,
    );
    const baseUrl = this.config.get<string>(
      'SSI_SNAPSHOT_BASE_URL',
      'https://iboard-query.ssi.com.vn/stock/exchange',
    );
    const timeoutMs = Number(
      this.config.get<string>('SSI_SNAPSHOT_TIMEOUT_MS', '15000'),
    );

    const exchanges: readonly SsiExchangePath[] = ['hose', 'hnx', 'upcom'];
    const headers = this.snapshotHeaders();

    const all = await Promise.all(
      exchanges.map(async (exchange) => {
        const url = `${baseUrl}/${exchange}?boardId=${encodeURIComponent(boardId)}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const resp = await fetch(url, {
            method: 'GET',
            headers,
            signal: controller.signal,
          });
          if (!resp.ok) {
            throw new Error(`SSI ${exchange} HTTP ${resp.status}`);
          }
          const json: unknown = await resp.json();
          return this.extractRows(json);
        } finally {
          clearTimeout(timer);
        }
      }),
    );

    return all.flat();
  }

  private snapshotHeaders(): Record<string, string> {
    return {
      Origin: this.config.get<string>(
        'SSI_SNAPSHOT_ORIGIN',
        'https://iboard.ssi.com.vn',
      ),
      Referer: this.config.get<string>(
        'SSI_SNAPSHOT_REFERER',
        'https://iboard.ssi.com.vn/',
      ),
      'User-Agent': this.config.get<string>(
        'SSI_SNAPSHOT_USER_AGENT',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ),
      Accept: 'application/json',
    };
  }

  private extractRows(payload: unknown): SsiSymbol[] {
    if (Array.isArray(payload)) return payload as SsiSymbol[];
    if (!payload || typeof payload !== 'object') return [];
    const candidate = payload as SsiResponseLike;
    if (Array.isArray(candidate.data)) return candidate.data as SsiSymbol[];
    if (Array.isArray(candidate.items)) return candidate.items as SsiSymbol[];
    return [];
  }

  private resolveTradingDate(rows: SsiSymbol[], fallbackYmd: string): string {
    const fromApi = rows.find(
      (r) => typeof r.tradingDate === 'string',
    )?.tradingDate;
    if (!fromApi) return fallbackYmd;
    const raw = fromApi.trim();
    if (/^\d{8}$/.test(raw)) {
      return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    return fallbackYmd;
  }

  private async upsertDailySeed(
    rows: SsiSymbol[],
    tradingDate: string,
  ): Promise<number> {
    const stockRows = rows
      .map((row) => this.toStockSeed(row))
      .filter((row): row is QueryDeepPartialEntity<Stock> => row !== null);

    if (stockRows.length === 0) return 0;

    await this.stockRepo.upsert(stockRows, {
      conflictPaths: ['symbol', 'boardId'],
      skipUpdateIfNoValuesChanged: true,
    });

    const identityByKey = new Map<
      string,
      { symbol: string; boardId: string }
    >();
    for (const row of rows) {
      const symbol = (row.stockSymbol ?? '').trim().toUpperCase();
      if (!symbol) continue;
      const boardId = this.resolveBoardId(row.boardId);
      identityByKey.set(`${symbol}|${boardId}`, { symbol, boardId });
    }
    const identities = [...identityByKey.values()];
    const stocks = await this.stockRepo.find({ where: identities });
    const stockIdByKey = new Map(
      stocks.map((s) => [`${s.symbol}|${s.boardId}`, s.id]),
    );

    const snapshots = rows
      .map((row) => this.toSnapshotSeed(row, tradingDate, stockIdByKey))
      .filter(
        (row): row is QueryDeepPartialEntity<StockBoardSnapshot> =>
          row !== null,
      );

    if (snapshots.length > 0) {
      await this.snapshotRepo.upsert(snapshots, {
        conflictPaths: ['stockId', 'tradingDate'],
        skipUpdateIfNoValuesChanged: true,
      });
    }

    return stockRows.length;
  }

  private toStockSeed(row: SsiSymbol): QueryDeepPartialEntity<Stock> | null {
    const symbol = (row.stockSymbol ?? '').trim().toUpperCase();
    if (!symbol) return null;
    const boardId = this.resolveBoardId(row.boardId);
    const exchange = this.mapExchange(row.exchange);
    if (!exchange) return null;

    return {
      symbol,
      boardId,
      name: (row.companyNameVi ?? symbol).trim(),
      nameEn: row.companyNameEn?.trim() || null,
      isin: row.isin?.trim() || null,
      exchange,
      lotSize: Math.max(1, Math.trunc(toNum(row.tradingUnit) || 100)),
      isActive: true,
      externalMetadata: {
        source: MarketSnapshotSource.SSI,
      },
    };
  }

  private toSnapshotSeed(
    row: SsiSymbol,
    tradingDate: string,
    stockIdByKey: Map<string, string>,
  ): QueryDeepPartialEntity<StockBoardSnapshot> | null {
    const symbol = (row.stockSymbol ?? '').trim().toUpperCase();
    if (!symbol) return null;
    const boardId = this.resolveBoardId(row.boardId);
    const stockId = stockIdByKey.get(`${symbol}|${boardId}`);
    if (!stockId) return null;

    const best1BidVol = Math.trunc(toNum(row.best1BidVol));
    const best2BidVol = Math.trunc(toNum(row.best2BidVol));
    const best3BidVol = Math.trunc(toNum(row.best3BidVol));
    const best1OfferVol = Math.trunc(toNum(row.best1OfferVol));
    const best2OfferVol = Math.trunc(toNum(row.best2OfferVol));
    const best3OfferVol = Math.trunc(toNum(row.best3OfferVol));

    return {
      stockId,
      tradingDate,
      referencePrice: toNum(row.refPrice),
      ceilingPrice: toNum(row.ceiling),
      floorPrice: toNum(row.floor),
      openPrice: toNum(row.openPrice),
      highPrice: toNum(row.highest),
      lowPrice: toNum(row.lowest),
      lastPrice: toNum(row.matchedPrice),
      lastVolume: Math.trunc(toNum(row.matchedVolume)),
      totalVolume: Math.trunc(
        toNum(row.stockVol) || toNum(row.nmTotalTradedQty),
      ),
      totalValue: toNum(row.nmTotalTradedValue),
      bidPrice1: toNum(row.best1Bid),
      bidPrice2: toNum(row.best2Bid),
      bidPrice3: toNum(row.best3Bid),
      bidVol1: best1BidVol,
      bidVol2: best2BidVol,
      bidVol3: best3BidVol,
      offerPrice1: toNum(row.best1Offer),
      offerPrice2: toNum(row.best2Offer),
      offerPrice3: toNum(row.best3Offer),
      offerVol1: best1OfferVol,
      offerVol2: best2OfferVol,
      offerVol3: best3OfferVol,
      totalBidQty: best1BidVol + best2BidVol + best3BidVol,
      totalOfferQty: best1OfferVol + best2OfferVol + best3OfferVol,
      ingestSource: MarketSnapshotSource.SSI,
      ingestedAt: new Date(),
      rawPayload: this.toRawPayload(row),
      sessionCode: row.exchangeSession ?? row.session ?? null,
      priceChange: row.priceChange != null ? toNum(row.priceChange) : null,
      priceChangePct:
        row.priceChangePercent != null ? toNum(row.priceChangePercent) : null,
    };
  }

  private mapExchange(exchange: string | undefined): Exchange | null {
    const normalized = (exchange ?? '').trim().toUpperCase();
    if (normalized === 'HOSE') return Exchange.HOSE;
    if (normalized === 'HNX') return Exchange.HNX;
    if (normalized === 'UPCOM') return Exchange.UPCOM;
    return null;
  }

  private async refreshQuotesCache(tradingDate: string): Promise<void> {
    const stocks = await this.stockRepo.find({
      where: { isActive: true, boardId: DEFAULT_STOCK_BOARD_ID },
      order: { symbol: 'ASC' },
    });
    const snapshots = await this.snapshotRepo.find({
      where: { tradingDate },
    });
    const snapshotByStockId = new Map(snapshots.map((s) => [s.stockId, s]));
    const rows = stocks.map((stock) => {
      const snap = snapshotByStockId.get(stock.id);
      return {
        symbol: stock.symbol,
        exchange: stock.exchange,
        fullName: stock.name,
        reference: toNum(snap?.referencePrice ?? 0),
        ceiling: toNum(snap?.ceilingPrice ?? 0),
        floor: toNum(snap?.floorPrice ?? 0),
        tradeLot: stock.lotSize,
        priceStep: toNum(stock.tickSize),
        tradingDate,
      };
    });

    const cacheKey = marketQuotesCacheKey(tradingDate, 'ALL');
    await this.redis.set(
      cacheKey,
      JSON.stringify(rows),
      CACHE_TTL_MARKET_QUOTES,
    );

    const byExchange = new Map<Exchange, typeof rows>();
    byExchange.set(
      Exchange.HOSE,
      rows.filter((row) => row.exchange === Exchange.HOSE),
    );
    byExchange.set(
      Exchange.HNX,
      rows.filter((row) => row.exchange === Exchange.HNX),
    );
    byExchange.set(
      Exchange.UPCOM,
      rows.filter((row) => row.exchange === Exchange.UPCOM),
    );

    await Promise.all(
      [...byExchange.entries()].map(([exchange, exchangeRows]) =>
        this.redis.set(
          marketQuotesCacheKey(tradingDate, exchange),
          JSON.stringify(exchangeRows),
          CACHE_TTL_MARKET_QUOTES,
        ),
      ),
    );
  }

  private toRawPayload(row: SsiSymbol): RawPayloadQuery {
    return row as unknown as RawPayloadQuery;
  }

  private resolveBoardId(boardId: string | undefined): string {
    const normalized = (boardId ?? '').trim().toUpperCase();
    return normalized || DEFAULT_STOCK_BOARD_ID;
  }

  private tradingDateYmdVN(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    return parts;
  }
}
