import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
vi.mock('./api', () => ({ swapApi: { executeSwap: vi.fn() } }));
import { swapApi } from './api';
import { useExecuteSwap } from './queries';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { wrapper };
}

describe('useExecuteSwap — idempotency by intent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes an idempotency key, reuses it on a retry of the same payload, rotates after success', async () => {
    const payload = { pairId: 'p1', type: 'buy' as const, baseAmount: '0.5', compartimento: 'spot' as const };
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useExecuteSwap(), { wrapper });

    // 1) first attempt fails (perceived failure)
    (swapApi.executeSwap as any).mockRejectedValueOnce(new Error('network'));
    await expect(result.current.mutateAsync(payload)).rejects.toBeTruthy();

    // 2) manual retry with the IDENTICAL payload succeeds
    (swapApi.executeSwap as any).mockResolvedValueOnce({ message: 'ok', data: {} });
    await result.current.mutateAsync({ ...payload });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const key1 = (swapApi.executeSwap as any).mock.calls[0][1];
    const key2 = (swapApi.executeSwap as any).mock.calls[1][1];
    expect(key1).toMatch(UUID_V4);
    expect(key2).toBe(key1); // retry reused the key → backend dedups

    // 3) a fresh identical submit AFTER success gets a NEW key (rotated on success)
    (swapApi.executeSwap as any).mockResolvedValueOnce({ message: 'ok', data: {} });
    await result.current.mutateAsync({ ...payload });
    const key3 = (swapApi.executeSwap as any).mock.calls[2][1];
    expect(key3).not.toBe(key1);
    expect(key3).toMatch(UUID_V4);
  });
});
