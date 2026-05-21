import type { MarketInstrumentDto } from '../modules/market/dto/market-instrument.dto';
import type { StockBoardSnapshot } from '../database/entities/stock-board-snapshot.entity';
import { toNum } from '../modules/market/util/market-price.util';

/** Loại payload WS — chỉ tick (snapshot bảng giá qua REST). */
export const WS_TY = {
  ORDERBOOK_DELTA: 'OB',
  TRADE_TICK: 'TT',
} as const;

/** Instrument → khóa ngắn (đồng bộ naming legacy board). */
export function compactInstrumentDto(
  d: MarketInstrumentDto,
): Record<string, unknown> {
  const o: Record<string, unknown> = {
    SB: d.symbol,
    SI: d.stockId,
    FN: d.fullName,
    TD: d.tradingDate,
    EX: d.exchange,
    CL: d.ceiling,
    FL: d.floor,
    RE: d.reference,
    B3: d.bidPrice3,
    V3: d.bidVol3,
    B2: d.bidPrice2,
    V2: d.bidVol2,
    B1: d.bidPrice1,
    V1: d.bidVol1,
    CP: d.closePrice,
    CV: d.closeVol,
    CH: d.priceChange,
    CHP: d.priceChangePercent,
    S1: d.offerPrice1,
    U1: d.offerVol1,
    S2: d.offerPrice2,
    U2: d.offerVol2,
    S3: d.offerPrice3,
    U3: d.offerVol3,
    TT: d.totalTrading,
    TV: d.totalTradingValue,
    AP: d.averagePrice,
    OP: d.open,
    HI: d.high,
    LO: d.low,
    FB: d.foreignBuy,
    FS: d.foreignSell,
    FR: d.foreignRemain,
    FO: d.foreignRoom,
    TO: d.TOTAL_OFFER_QTTY,
    TB: d.TOTAL_BID_QTTY,
    SID: d.tradingSessionId,
    ts: d.ts,
    kid: d.kid,
  };
  return o;
}

/** Delta sổ TOP 3 × 2 cạnh — compact key như bootstrap (B/V mua, S/U bán). */
export function compactOrderbookDelta(
  changes: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const rows: ReadonlyArray<readonly [string, string, string, string]> = [
    ['bid1Price', 'bid1Volume', 'B1', 'V1'],
    ['bid2Price', 'bid2Volume', 'B2', 'V2'],
    ['bid3Price', 'bid3Volume', 'B3', 'V3'],
    ['ask1Price', 'ask1Volume', 'S1', 'U1'],
    ['ask2Price', 'ask2Volume', 'S2', 'U2'],
    ['ask3Price', 'ask3Volume', 'S3', 'U3'],
  ];
  for (const [pk, vk, ck, ckV] of rows) {
    if (pk in changes) out[ck] = changes[pk];
    if (vk in changes) out[ckV] = changes[vk];
  }
  return out;
}

export function compactTradeTick(
  lastPrice: number,
  matchedVolume: number,
  priceChange: number,
  priceChangePct: number,
): Record<string, unknown> {
  return {
    CP: lastPrice,
    CV: matchedVolume,
    CH: priceChange,
    CHP: priceChangePct,
  };
}

/** TOP3 + tổng dư mua/bán — UI đã có giá khớp từ REST khi mới connect. */
export const BOARD_DEPTH_PATCH_KEYS = [
  'B3',
  'V3',
  'B2',
  'V2',
  'B1',
  'V1',
  'S1',
  'U1',
  'S2',
  'U2',
  'S3',
  'U3',
  'TB',
  'TO',
] as const;

export const BOARD_PATCH_KEYS = [
  ...BOARD_DEPTH_PATCH_KEYS,
  'CP',
  'CV',
  'CH',
  'CHP',
  'TT',
  'HI',
  'LO',
  'OP',
] as const;

/** Patch bảng giá TOP3 + khớp + KL phiên — FE merge qua `ty=OB`. */
export function compactSnapshotBoardPatch(
  snap: StockBoardSnapshot,
): Record<string, unknown> {
  return {
    B3: toNum(snap.bidPrice3),
    V3: snap.bidVol3,
    B2: toNum(snap.bidPrice2),
    V2: snap.bidVol2,
    B1: toNum(snap.bidPrice1),
    V1: snap.bidVol1,
    S1: toNum(snap.offerPrice1),
    U1: snap.offerVol1,
    S2: toNum(snap.offerPrice2),
    U2: snap.offerVol2,
    S3: toNum(snap.offerPrice3),
    U3: snap.offerVol3,
    CP: toNum(snap.lastPrice),
    CV: snap.lastVolume,
    CH: toNum(snap.priceChange ?? 0),
    CHP: toNum(snap.priceChangePct ?? 0),
    TT: snap.totalVolume,
    HI: toNum(snap.highPrice),
    LO: toNum(snap.lowPrice),
    OP: toNum(snap.openPrice),
    TB: snap.totalBidQty,
    TO: snap.totalOfferQty,
  };
}

/** Chỉ giữ field compact đổi so với lần emit trước. */
export function diffSnapshotBoardPatch(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  keys: readonly string[] = BOARD_PATCH_KEYS,
): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  for (const k of keys) {
    if (prev[k] !== next[k]) changes[k] = next[k];
  }
  return changes;
}

/** Lần đầu treo lệnh: chỉ depth khác 0 (giá khớp/phiên đã có từ REST). */
export function firstDepthOnlyDelta(
  next: Record<string, unknown>,
): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  for (const k of BOARD_DEPTH_PATCH_KEYS) {
    const v = next[k];
    if (v !== 0 && v !== undefined) changes[k] = v;
  }
  return changes;
}
