import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
vi.mock('./api', () => ({ tradingApi: { placeOrder: vi.fn() } }));
import { tradingApi } from './api';
import { usePlaceOrder } from './queries';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { wrapper, spy };
}

describe('usePlaceOrder', () => {
  beforeEach(() => vi.clearAllMocks());
  it('invalidates balances + active orders on success', async () => {
    (tradingApi.placeOrder as any).mockResolvedValue({ success: true, order: { id: 'o1' }, message: 'ok' });
    const { wrapper, spy } = makeWrapper();
    const { result } = renderHook(() => usePlaceOrder(), { wrapper });
    await result.current.mutateAsync({ tradingPairId: 'p1', orderType: 'limit', side: 'buy', quantity: '0.5', price: '64000' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const invalidated = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(invalidated.some((k) => k?.includes('balances'))).toBe(true);
    expect(invalidated.some((k) => k?.includes('orders'))).toBe(true);
  });
});
