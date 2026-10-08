'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '@/shared/api';
import { walletApi } from './api';
import type {
  BalanceEntry,
  CompartmentTransferRequest,
  CompartmentTransferResponse,
  DepositAddressResponse,
  WithdrawRequest,
  WithdrawResponse,
  BlockchainTransaction,
  TransactionHistoryParams,
} from './types';

export const WALLET_BALANCES_KEY = ['wallet', 'balances'] as const;
export const WALLET_TX_KEY = ['wallet', 'transactions'] as const;
export const walletDepositKey = (cryptoId: string) => ['wallet', 'deposit-address', cryptoId] as const;

export function useMyBalances() {
  return useQuery<BalanceEntry[], ApiError>({
    queryKey: WALLET_BALANCES_KEY,
    queryFn: () => walletApi.getBalances(),
    staleTime: 15_000,
  });
}

export function useCompartmentTransfer() {
  const qc = useQueryClient();
  return useMutation<CompartmentTransferResponse, ApiError, CompartmentTransferRequest>({
    mutationFn: walletApi.transferCompartments,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WALLET_BALANCES_KEY });
    },
  });
}

export function useDepositAddress(cryptoId: string, enabled: boolean) {
  return useQuery<DepositAddressResponse, ApiError>({
    queryKey: walletDepositKey(cryptoId),
    queryFn: () => walletApi.getDepositAddress(cryptoId),
    enabled: enabled && Boolean(cryptoId),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useWithdraw() {
  const qc = useQueryClient();
  return useMutation<WithdrawResponse, ApiError, WithdrawRequest>({
    mutationFn: walletApi.withdraw,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WALLET_BALANCES_KEY });
      qc.invalidateQueries({ queryKey: WALLET_TX_KEY });
    },
  });
}

export function useTransactionHistory(params?: TransactionHistoryParams) {
  return useQuery<BlockchainTransaction[], ApiError>({
    queryKey: [...WALLET_TX_KEY, params ?? {}],
    queryFn: () => walletApi.getTransactions(params),
    staleTime: 15_000,
  });
}
