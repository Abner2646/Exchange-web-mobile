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

  it('useAcceptOffer calls acceptOffer and does not retry', async () => {
    (p2pApi.acceptOffer as any).mockResolvedValue({ id: 't1', status: 'initiated' });
    const { result } = renderHook(() => useAcceptOffer(), { wrapper: wrapper() });
    result.current.mutate({ offerId: 'o1', amount: '1', paymentMethodId: 'pm1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(p2pApi.acceptOffer).toHaveBeenCalledWith({ offerId: 'o1', amount: '1', paymentMethodId: 'pm1' });
  });

  it('useConfirmPayment calls confirmPayment', async () => {
    (p2pApi.confirmPayment as any).mockResolvedValue({ id: 't1', status: 'payment_confirmed' });
    const { result } = renderHook(() => useConfirmPayment(), { wrapper: wrapper() });
    result.current.mutate('t1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(p2pApi.confirmPayment).toHaveBeenCalledWith('t1');
  });
});
