'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '@/shared/api';
import { tradingApi } from './api';
import type { TradingPair, OrderBook, RecentTrade, TradingOrder } from './types';

export const TRADING_PAIRS_KEY = ['trading', 'pairs'] as const;
export const tradingBookKey = (id: string) => ['trading', 'orderbook', id] as const;
export const tradingTradesKey = (id: string) => ['trading', 'recent-trades', id] as const;
export const TRADING_ORDERS_KEY = ['trading', 'orders'] as const;

export function usePairs() {
  return useQuery<TradingPair[], ApiError>({
    queryKey: TRADING_PAIRS_KEY,
    queryFn: () => tradingApi.getPairs(),
    staleTime: 60_000,
  });
}

export function useOrderBook(tradingPairId: string, enabled: boolean) {
  return useQuery<OrderBook, ApiError>({
    queryKey: tradingBookKey(tradingPairId),
    queryFn: () => tradingApi.getOrderBook(tradingPairId),
    enabled: enabled && Boolean(tradingPairId),
    refetchInterval: 5_000,
    staleTime: 2_000,
  });
}

export function useRecentTrades(tradingPairId: string, enabled: boolean) {
  return useQuery<RecentTrade[], ApiError>({
    queryKey: tradingTradesKey(tradingPairId),
    queryFn: () => tradingApi.getRecentTrades(tradingPairId),
    enabled: enabled && Boolean(tradingPairId),
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

export function useActiveOrders() {
  return useQuery<TradingOrder[], ApiError>({
    queryKey: TRADING_ORDERS_KEY,
    queryFn: () => tradingApi.getActiveOrders(),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation<{ success: boolean; message?: string; error?: string }, ApiError, string>({
    mutationFn: (orderId: string) => tradingApi.cancelOrder(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TRADING_ORDERS_KEY });
    },
  });
}
