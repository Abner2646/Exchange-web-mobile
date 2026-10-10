import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
vi.mock('./api', () => ({ tradingApi: { getPairs: vi.fn(), getOrderBook: vi.fn(), getRecentTrades: vi.fn() } }));
import { tradingApi } from './api';
import { usePairs, useOrderBook } from './queries';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('trading read hooks', () => {
  beforeEach(() => vi.clearAllMocks());
  it('usePairs returns pairs', async () => {
    (tradingApi.getPairs as any).mockResolvedValue([{ id: 'p1', baseSymbol: 'BTC', quoteSymbol: 'USDT' }]);
    const { result } = renderHook(() => usePairs(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].baseSymbol).toBe('BTC');
  });
  it('useOrderBook is disabled without a pair id', () => {
    const { result } = renderHook(() => useOrderBook('', false), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(tradingApi.getOrderBook).not.toHaveBeenCalled();
  });
});
