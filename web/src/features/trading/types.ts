
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type OrderStatus =
  | 'pending' | 'open' | 'partially_filled' | 'filled' | 'cancelled' | 'expired' | 'rejected';

/** Raw pair from GET /trading/pairs (DECIMAL fields are JSON strings). */
export interface TradingPairDTO {
  id: string;
  symbol: string; // "BASE/QUOTE"
  baseAssetId: string;
  quoteAssetId: string;
  status: 'active' | 'paused' | 'delisted';
  minOrderAmount: string;
  maxOrderAmount: string | null;
  pricePrecision: number;
  quantityPrecision: number;
  makerFeePercent: string;
  takerFeePercent: string;
  lastPrice: string;
  priceChange24h?: string;
  volume24h?: string;
}

/** Normalized pair the UI consumes (symbols split out). */
export interface TradingPair {
  id: string;
  symbol: string;
  baseAssetId: string;
  quoteAssetId: string;
  baseSymbol: string;
  quoteSymbol: string;
  status: 'active' | 'paused' | 'delisted';
  minOrderAmount: string;
  maxOrderAmount: string | null;
  pricePrecision: number;
  quantityPrecision: number;
  makerFeePercent: string;
  takerFeePercent: string;
  lastPrice: string;
  priceChange24h?: string;
  volume24h?: string;
}

/** Order-book level — NUMBERS from the backend; market display ONLY. */
export interface OrderBookEntry {
  price: number;
  quantity: number;
  total: number;
  orders: number;
}

export interface OrderBook {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  timestamp: string;
}

export interface RecentTrade {
  id: string;
  price: number | string;
  quantity: number | string;
  side: OrderSide;
  createdAt?: string;
}

export interface PlaceOrderRequest {
  tradingPairId: string;
  orderType: OrderType;
  side: OrderSide;
  quantity: string; // canonical decimal string
  price?: string; // canonical decimal string; required for limit, omitted for market
  clientOrderId?: string;
}

export interface TradingOrder {
  id: string;
  tradingPairId: string;
  orderType: OrderType | string;
  side: OrderSide;
  quantity: string;
  quantityRemaining: string;
  price: string | null;
  status: OrderStatus;
  feePercent: string;
  feeCurrency: string | null;
  timeInForce?: string;
  createdAt?: string;
}

export interface PlaceOrderResponse {
  success: boolean;
  order: TradingOrder;
  message: string;
}
