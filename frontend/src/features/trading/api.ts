import { apiClient } from '../../shared/api';
import type { CanonicalAmount } from '../../shared/money';

// Ticker data for the pairs list
export interface TradingTicker {
  tradingPairId: string;
  symbol: string;
  baseAsset: { symbol: string; iconUrl?: string };
  quoteAsset: { symbol: string; iconUrl?: string };
  lastPrice: CanonicalAmount | number;
  priceChange24h: number;
  high24h: CanonicalAmount | number;
  low24h: CanonicalAmount | number;
  volume24h: CanonicalAmount | number;
  trades24h: number;
}

export interface TickersResponse {
  success: boolean;
  tickers: TradingTicker[];
}

export async function fetchPairs(): Promise<TradingTicker[]> {
  const res = await apiClient.get<TickersResponse>('/trading/tickers');
  return res.tickers || [];
}

// Order book data
export interface OrderBookLevel {
  price: CanonicalAmount;
  quantity: CanonicalAmount;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  lastUpdateId?: number;
}

export interface OrderBookResponse {
  success: boolean;
  orderBook: OrderBook;
}

export async function fetchOrderBook(tradingPairId: string): Promise<OrderBook> {
  const res = await apiClient.get<OrderBookResponse>(`/trading/orderbook/${tradingPairId}`);
  return res.orderBook;
}

// Candlestick chart data
export interface ChartDataPoint {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ChartResponse {
  success: boolean;
  data: ChartDataPoint[];
}

export async function fetchChartData(tradingPairId: string, interval: string = '1h'): Promise<ChartDataPoint[]> {
  const res = await apiClient.get<ChartResponse>(`/trading/chart/${tradingPairId}?interval=${interval}`);
  return res.data || [];
}
