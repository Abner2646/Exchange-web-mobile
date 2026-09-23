import { useQuery } from 'react-query';
import { fetchPairs, fetchOrderBook, fetchChartData, TradingTicker, OrderBook, ChartDataPoint } from './api';

export const TRADING_KEYS = {
  all: ['trading'] as const,
  pairs: () => [...TRADING_KEYS.all, 'pairs'] as const,
  orderBook: (pairId: string) => [...TRADING_KEYS.all, 'orderBook', pairId] as const,
  chart: (pairId: string, interval: string) => [...TRADING_KEYS.all, 'chart', pairId, interval] as const,
};

export function useTradingPairs() {
  return useQuery<TradingTicker[], Error>(
    TRADING_KEYS.pairs(),
    fetchPairs,
    {
      staleTime: 30000,
    }
  );
}

export function useOrderBook(pairId: string | null) {
  return useQuery<OrderBook, Error>(
    pairId ? TRADING_KEYS.orderBook(pairId) : TRADING_KEYS.all, // dummy key if no pair, will be disabled
    () => fetchOrderBook(pairId!),
    {
      enabled: !!pairId,
      refetchInterval: 5000, // feel live
    }
  );
}

export function useChartData(pairId: string | null, interval: string = '1h') {
  return useQuery<ChartDataPoint[], Error>(
    pairId ? TRADING_KEYS.chart(pairId, interval) : TRADING_KEYS.all,
    () => fetchChartData(pairId!, interval),
    {
      enabled: !!pairId,
      staleTime: 60000, // 1 minute
    }
  );
}
