import type { PortfolioPositionRow } from '@/hooks/use-portfolio-overview';
import type { PriceBoardRow } from '@/components/priceboard/price-board-types';

function pctChange(part: number, whole: number): number {
  if (whole === 0) return 0;
  return (part / whole) * 100;
}

/** Cập nhật giá TT / L/L chưa thực hiện theo bảng giá realtime (Redux market). */
export function applyLiveMarketToPosition(
  row: PortfolioPositionRow,
  live?: PriceBoardRow,
): PortfolioPositionRow {
  const matchPx = live?.match?.p ?? 0;
  if (matchPx <= 0) return row;

  const refPrice =
    live?.ref && live.ref > 0 ? live.ref : row.referencePrice > 0 ? row.referencePrice : row.avgPrice;
  const totalQty = row.totalQuantity;
  const costBasis = row.avgPrice * totalQty;
  const marketValue = matchPx * totalQty;
  const unrealizedPnL = marketValue - costBasis;
  const dayPnL = (matchPx - refPrice) * totalQty;

  return {
    ...row,
    marketPrice: matchPx,
    referencePrice: refPrice,
    marketValue,
    costBasis,
    unrealizedPnL,
    unrealizedPnLPercent: pctChange(unrealizedPnL, costBasis),
    dayPnL,
    dayChangePercent: pctChange(matchPx - refPrice, refPrice),
  };
}

export function summarizeLivePositions(positions: PortfolioPositionRow[]) {
  let totalMarketValue = 0;
  let totalCostBasis = 0;
  let totalUnrealized = 0;
  let totalDayPnL = 0;
  for (const p of positions) {
    totalMarketValue += p.marketValue;
    totalCostBasis += p.costBasis;
    totalUnrealized += p.unrealizedPnL;
    totalDayPnL += p.dayPnL;
  }
  return {
    totalMarketValue,
    totalCostBasis,
    totalUnrealized,
    totalUnrealizedPct: pctChange(totalUnrealized, totalCostBasis),
    totalDayPnL,
    totalDayPnLPct: pctChange(totalDayPnL, totalCostBasis),
    positionCount: positions.length,
  };
}
