import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
vi.mock('./api', () => ({ swapApi: { getQuote: vi.fn() } }));
import { swapApi } from './api';
import { useSwapQuote } from './queries';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useSwapQuote', () => {
  beforeEach(() => vi.clearAllMocks());
  it('is disabled when enabled=false (no fetch)', async () => {
    const { result } = renderHook(
      () => useSwapQuote({ pairId: 'p1', baseAmount: '0', type: 'buy' }, false),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe('idle');
    expect(swapApi.getQuote).not.toHaveBeenCalled();
  });
  it('fetches when enabled', async () => {
    (swapApi.getQuote as any).mockResolvedValue({ par: {}, calculo: { finalAmount: '1' }, advertencias: [] });
    const { result } = renderHook(
      () => useSwapQuote({ pairId: 'p1', baseAmount: '0.5', type: 'buy' }, true),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.calculo.finalAmount).toBe('1');
  });
});
