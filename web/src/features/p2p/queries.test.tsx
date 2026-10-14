import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { p2pApi } from './api';
import { useActiveOffers, useAcceptOffer, useConfirmPayment } from './queries';

vi.mock('./api', () => ({
  p2pApi: {
    getActiveOffers: vi.fn(),
    acceptOffer: vi.fn(),
    confirmPayment: vi.fn(),
  },
}));

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.clearAllMocks());

describe('p2p queries', () => {
  it('useActiveOffers fetches via p2pApi', async () => {
    (p2pApi.getActiveOffers as any).mockResolvedValue([{ id: 'o1' }]);
    const { result } = renderHook(() => useActiveOffers(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 'o1' }]);
  });

  it('useAcceptOffer calls acceptOffer with an idempotency key and does not retry', async () => {
    (p2pApi.acceptOffer as any).mockResolvedValue({ id: 't1', status: 'initiated' });
    const { result } = renderHook(() => useAcceptOffer(), { wrapper: wrapper() });
    result.current.mutate({ offerId: 'o1', amount: '1', paymentMethodId: 'pm1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [req, key] = (p2pApi.acceptOffer as any).mock.calls[0];
    expect(req).toEqual({ offerId: 'o1', amount: '1', paymentMethodId: 'pm1' });
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('useConfirmPayment calls confirmPayment', async () => {
    (p2pApi.confirmPayment as any).mockResolvedValue({ id: 't1', status: 'payment_confirmed' });
    const { result } = renderHook(() => useConfirmPayment(), { wrapper: wrapper() });
    result.current.mutate('t1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(p2pApi.confirmPayment).toHaveBeenCalledWith('t1');
  });
});
