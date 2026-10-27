'use client';

import { useQuery } from '@tanstack/react-query';

// Live market data, sourced directly from CoinGecko's public API (same as the V1
// home). This is display-only market data — never the money path.
export interface MarketCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number | null;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d_in_currency: number | null;
  total_volume: number | null;
  market_cap: number | null;
}

const ENDPOINT =
  'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc' +
  '&per_page=50&page=1&sparkline=false&price_change_percentage=24h,7d';

async function fetchMarkets(): Promise<MarketCoin[]> {
  const res = await fetch(ENDPOINT, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** Shared query — the markets table and the top-gainers card dedupe to one fetch. */
export function useMarkets() {
  return useQuery({
    queryKey: ['coingecko-markets'],
    queryFn: fetchMarkets,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}

// ---- formatting helpers (null-safe; CoinGecko sends null for some fields) ----

export function formatPrice(v: number | null | undefined): string {
  const n = v ?? 0;
  const digits = n >= 1 ? 2 : 6;
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: digits });
}

export function formatCompact(v: number | null | undefined): string {
  const n = v ?? 0;
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(2) + 'K';
  return '$' + n.toFixed(2);
}

export function formatPct(v: number | null | undefined): { text: string; sign: 'pos' | 'neg' | 'neu' } {
  const n = v ?? 0;
  const sign = n > 0 ? 'pos' : n < 0 ? 'neg' : 'neu';
  return { text: (n > 0 ? '+' : '') + n.toFixed(2) + '%', sign };
}
