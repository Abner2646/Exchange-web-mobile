import { apiClient } from '@/shared/api';
import type { TradingPair, TradingPairDTO, OrderBook, RecentTrade, TradingOrder, PlaceOrderRequest, PlaceOrderResponse } from './types';

interface PairsEnvelope { success?: boolean; pairs?: TradingPairDTO[] }
interface OrderBookEnvelope { success?: boolean; orderBook?: OrderBook }
interface TradesEnvelope { success?: boolean; trades?: RecentTrade[] }
interface OrdersEnvelope { success?: boolean; orders?: TradingOrder[]; total?: number }

function normalizePair(dto: TradingPairDTO): TradingPair | null {
  const parts = (dto.symbol ?? '').split('/');
  if (parts.length !== 2) return null;
  return {
    id: dto.id,
    symbol: dto.symbol,
    baseAssetId: dto.baseAssetId,
    quoteAssetId: dto.quoteAssetId,
    baseSymbol: parts[0],
    quoteSymbol: parts[1],
    status: dto.status,
    minOrderAmount: dto.minOrderAmount,
    maxOrderAmount: dto.maxOrderAmount,
    pricePrecision: dto.pricePrecision,
    quantityPrecision: dto.quantityPrecision,
    makerFeePercent: dto.makerFeePercent,
    takerFeePercent: dto.takerFeePercent,
    lastPrice: dto.lastPrice,
    priceChange24h: dto.priceChange24h,
    volume24h: dto.volume24h,
  };
}

export const tradingApi = {
  getPairs: () =>
    apiClient.get<PairsEnvelope | TradingPairDTO[]>('/trading/pairs').then((r) => {
      const rows = Array.isArray(r) ? r : (r.pairs ?? []);
      return rows.map(normalizePair).filter((p): p is TradingPair => p !== null && p.status === 'active');
    }),

  getOrderBook: (tradingPairId: string) =>
    apiClient.get<OrderBookEnvelope | OrderBook>(`/trading/orderbook/${tradingPairId}`).then((r) =>
      'orderBook' in r && r.orderBook ? r.orderBook : (r as OrderBook),
    ),

  getRecentTrades: (tradingPairId: string) =>
    apiClient.get<TradesEnvelope | RecentTrade[]>(`/trading/trades/${tradingPairId}`).then((r) =>
      Array.isArray(r) ? r : (r.trades ?? []),
    ),

  getActiveOrders: () =>
    apiClient.get<OrdersEnvelope | TradingOrder[]>('/trading/orders/active').then((r) =>
      Array.isArray(r) ? r : (r.orders ?? []),
    ),

  cancelOrder: (orderId: string) =>
    apiClient.delete<{ success: boolean; message?: string; error?: string }>(`/trading/orders/${orderId}`),

  // Money POST. The shared client auto-attaches an Idempotency-Key (isMoneyEndpoint
  // matches /trading/order). quantity/price stay STRINGS; price is omitted for market.
  placeOrder: (req: PlaceOrderRequest) => {
    const body: Record<string, unknown> = {
      tradingPairId: req.tradingPairId,
      orderType: req.orderType,
      side: req.side,
      quantity: req.quantity,
    };
    if (req.orderType === 'limit' && req.price != null) body.price = req.price;
    if (req.clientOrderId) body.clientOrderId = req.clientOrderId;
    return apiClient.post<PlaceOrderResponse>('/trading/orders', body);
  },
};
