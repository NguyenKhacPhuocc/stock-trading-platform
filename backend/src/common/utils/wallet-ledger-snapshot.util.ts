/** Snapshot số dư ghi vào cash_transactions sau mỗi bút toán. */
export function walletLedgerSnapshot(wallet: {
  availableBalance: unknown;
  lockedBalance: unknown;
}): { availableAfter: number; balanceAfter: number } {
  const availableAfter = Number(wallet.availableBalance);
  const locked = Number(wallet.lockedBalance);
  return {
    availableAfter,
    balanceAfter: availableAfter + locked,
  };
}
