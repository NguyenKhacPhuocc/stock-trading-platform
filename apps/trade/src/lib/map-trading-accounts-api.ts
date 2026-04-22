import { z } from 'zod';
import type { TradingAccountSummary } from '@/store/slices/auth.slice';

const rowSchema = z.object({
  tradingAccountId: z.string().min(1),
  id: z.string(),
  type: z.enum(['CASH', 'MARGIN', 'DERIVATIVE', 'BOND']),
  channel: z.enum(['STOCK', 'DERIVATIVE', 'BOND', 'FUND']),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  isDefault: z.boolean(),
});

/** Parse `d` từ GET /users/me/accounts → Redux `TradingAccountSummary[]` */
export function mapTradingAccountsEnvelope(d: unknown): TradingAccountSummary[] {
  if (!d || typeof d !== 'object') return [];
  const acc = (d as { accounts?: unknown }).accounts;
  if (!Array.isArray(acc)) return [];
  const out: TradingAccountSummary[] = [];
  for (const item of acc) {
    const p = rowSchema.safeParse(item);
    if (!p.success) continue;
    const r = p.data;
    out.push({
      id: r.tradingAccountId,
      accountId: r.id,
      isDefault: r.isDefault,
      type: r.type,
      channel: r.channel,
      status: r.status,
    });
  }
  return out;
}
