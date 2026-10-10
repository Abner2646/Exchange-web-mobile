'use client';

import { useQuery } from '@tanstack/react-query';
import type { ApiError } from '@/shared/api';
import { swapApi } from './api';
import type { SwapPair } from './types';

export const SWAP_PAIRS_KEY = ['swap', 'pairs'] as const;

export function usePairs() {
  return useQuery<SwapPair[], ApiError>({
    queryKey: SWAP_PAIRS_KEY,
    queryFn: () => swapApi.getPairs(),
    staleTime: 60_000,
  });
}
