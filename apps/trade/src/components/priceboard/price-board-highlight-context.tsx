'use client';

import { createContext, useContext } from 'react';

const PriceBoardHighlightContext = createContext<string | null>(null);

export function PriceBoardHighlightProvider({
  symbol,
  children,
}: {
  symbol: string | null;
  children: React.ReactNode;
}) {
  return (
    <PriceBoardHighlightContext.Provider value={symbol}>
      {children}
    </PriceBoardHighlightContext.Provider>
  );
}

export function usePriceBoardHighlighted(symbol: string): boolean {
  const active = useContext(PriceBoardHighlightContext);
  return active === symbol;
}
