import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
vi.mock('./api', () => ({ swapApi: { executeSwap: vi.fn() } }));
import { swapApi } from './api';
import { useExecuteSwap } from './queries';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { wrapper, spy };
}

describe('useExecuteSwap', () => {
  beforeEach(() => vi.clearAllMocks());
  it('invalidates balances + swap history on success', async () => {
    (swapApi.executeSwap as any).mockResolvedValue({ message: 'ok', data: { precioUsado: '1' } });
    const { wrapper, spy } = makeWrapper();
    const { result } = renderHook(() => useExecuteSwap(), { wrapper });
    await result.current.mutateAsync({ pairId: 'p1', type: 'buy', baseAmount: '0.5', compartimento: 'funding' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const invalidated = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(invalidated.some((k) => k?.includes('balances'))).toBe(true);
    expect(invalidated.some((k) => k?.includes('my-swaps'))).toBe(true);
  });
});
