import type { MarketInstrumentDto } from '../modules/market/dto/market-instrument.dto';

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
): Record<string, unknown> {
  return {
    CP: lastPrice,
    CV: matchedVolume,
  };
}
