import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
vi.mock('./api', () => ({ tradingApi: { getActiveOrders: vi.fn(), cancelOrder: vi.fn() } }));
import { tradingApi } from './api';
import { useActiveOrders, useCancelOrder } from './queries';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { wrapper, spy };
}

describe('trading order hooks', () => {
  beforeEach(() => vi.clearAllMocks());
  it('useActiveOrders returns orders', async () => {
    (tradingApi.getActiveOrders as any).mockResolvedValue([{ id: 'o1', status: 'open' }]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useActiveOrders(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].id).toBe('o1');
  });
  it('useCancelOrder invalidates orders on success', async () => {
    (tradingApi.cancelOrder as any).mockResolvedValue({ success: true });
    const { wrapper, spy } = makeWrapper();
    const { result } = renderHook(() => useCancelOrder(), { wrapper });
    await result.current.mutateAsync('o1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const invalidated = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(invalidated.some((k) => k?.includes('orders'))).toBe(true);
  });
});
