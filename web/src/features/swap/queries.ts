'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '@/shared/api';
import { swapApi } from './api';
import type { SwapPair, QuoteRequest, QuoteResponse, CheckLimitResponse, ExecuteSwapRequest, ExecuteSwapResponse, MySwap } from './types';
import { WALLET_BALANCES_KEY } from '@/features/wallet/queries';

export const SWAP_PAIRS_KEY = ['swap', 'pairs'] as const;

export function usePairs() {
  return useQuery<SwapPair[], ApiError>({
    queryKey: SWAP_PAIRS_KEY,
    queryFn: () => swapApi.getPairs(),
    staleTime: 60_000,
  });
}

export const SWAP_QUOTE_KEY = (req: QuoteRequest) =>
  ['swap', 'quote', req.pairId, req.type, req.baseAmount] as const;

export function useSwapQuote(req: QuoteRequest, enabled: boolean) {
  return useQuery<QuoteResponse, ApiError>({
    queryKey: SWAP_QUOTE_KEY(req),
    queryFn: () => swapApi.getQuote(req),
    enabled,
    retry: false,
    staleTime: 10_000,
  });
}

export function useCheckLimit(quoteAmount: string, enabled: boolean) {
  return useQuery<CheckLimitResponse, ApiError>({
    queryKey: ['swap', 'check-limit', quoteAmount] as const,
    queryFn: () => swapApi.checkLimit(quoteAmount),
    enabled,
    retry: false,
    staleTime: 10_000,
  });
}

export const SWAP_MY_SWAPS_KEY = ['swap', 'my-swaps'] as const;
export const SWAP_DAILY_VOLUME_KEY = ['swap', 'daily-volume'] as const;

export function useMySwaps() {
  return useQuery<MySwap[], ApiError>({
    queryKey: SWAP_MY_SWAPS_KEY,
    queryFn: () => swapApi.getMySwaps(),
    staleTime: 15_000,
  });
}

export function useExecuteSwap() {
  const qc = useQueryClient();
  // Mutations do not retry by default — combined with disabled-while-pending this
  // is the S3 double-submit guard (per-intent idempotency key is a deferred go-live item).
  return useMutation<ExecuteSwapResponse, ApiError, ExecuteSwapRequest>({
    mutationFn: swapApi.executeSwap,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WALLET_BALANCES_KEY });
      qc.invalidateQueries({ queryKey: SWAP_MY_SWAPS_KEY });
      qc.invalidateQueries({ queryKey: SWAP_DAILY_VOLUME_KEY });
    },
  });
}
