import type { EntityManager } from 'typeorm';
import { PositionTransaction } from '../../database/entities/position-transaction.entity';
import type { StockLedgerType } from '../const/stock-ledger';

export type RecordPositionLedgerInput = {
  tradingAccountId: string;
  stockId: string;
  type: StockLedgerType;
  quantityDelta: number;
  lockedDelta: number;
  quantityAfter: number;
  lockedAfter: number;
  refOrderId?: string | null;
  refTradeId?: string | null;
  description?: string | null;
};

export async function recordPositionLedger(
  manager: EntityManager,
  input: RecordPositionLedgerInput,
): Promise<void> {
  await manager.save(
    manager.create(PositionTransaction, {
      tradingAccountId: input.tradingAccountId,
      stockId: input.stockId,
      type: input.type,
      quantityDelta: input.quantityDelta,
      lockedDelta: input.lockedDelta,
      quantityAfter: input.quantityAfter,
      lockedAfter: input.lockedAfter,
      refOrderId: input.refOrderId ?? null,
      refTradeId: input.refTradeId ?? null,
      description: input.description ?? null,
    }),
  );
}
