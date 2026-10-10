import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('./api', () => ({ swapApi: { getPairs: vi.fn() } }));
import { swapApi } from './api';
import { usePairs } from './queries';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('usePairs', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns normalized pairs', async () => {
    (swapApi.getPairs as any).mockResolvedValue([{ id: 'p1', baseSymbol: 'BTC', quoteSymbol: 'USDT' }]);
    const { result } = renderHook(() => usePairs(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].baseSymbol).toBe('BTC');
  });
});
