// web/src/features/wallet/queries.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const { getBalances, transferCompartments, withdraw, getTransactions, getDepositAddress } = vi.hoisted(() => ({
  getBalances: vi.fn(),
  transferCompartments: vi.fn(),
  withdraw: vi.fn(),
  getTransactions: vi.fn(),
  getDepositAddress: vi.fn(),
}));

vi.mock('./api', () => ({
  walletApi: { getBalances, transferCompartments, withdraw, getTransactions, getDepositAddress },
}));

import {
  useMyBalances,
  useCompartmentTransfer,
  useWithdraw,
  WALLET_BALANCES_KEY,
  WALLET_TX_KEY,
} from './queries';

function wrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  getBalances.mockReset();
  transferCompartments.mockReset();
  withdraw.mockReset();
  getTransactions.mockReset();
});

describe('wallet queries', () => {
  it('useMyBalances fetches balances', async () => {
    getBalances.mockResolvedValueOnce([{ criptomonedaId: 'c1' }]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useMyBalances(), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].criptomonedaId).toBe('c1');
  });

  it('useCompartmentTransfer invalidates the balances key on success', async () => {
    transferCompartments.mockResolvedValueOnce({ message: 'ok', data: { from: 'funding', to: 'spot' } });
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCompartmentTransfer(), { wrapper: wrapper(qc) });
    await result.current.mutateAsync({ cryptoId: 'c1', amount: '10', from: 'funding', to: 'spot' });
    expect(spy).toHaveBeenCalledWith({ queryKey: WALLET_BALANCES_KEY });
  });

  it('useWithdraw invalidates both balances and tx keys on success', async () => {
    withdraw.mockResolvedValueOnce({ id: 't1', status: 'pending', type: 'withdrawal' });
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useWithdraw(), { wrapper: wrapper(qc) });
    await result.current.mutateAsync({ cryptoId: 'c1', amount: '0.5', destinationAddress: 'bc1dest' });
    expect(spy).toHaveBeenCalledWith({ queryKey: WALLET_BALANCES_KEY });
    expect(spy).toHaveBeenCalledWith({ queryKey: WALLET_TX_KEY });
  });
});
