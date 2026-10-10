'use client';

import { useQuery } from '@tanstack/react-query';
import type { ApiError } from '@/shared/api';
import { swapApi } from './api';
import type { SwapPair, QuoteRequest, QuoteResponse } from './types';

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
