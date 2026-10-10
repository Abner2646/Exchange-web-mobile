import { describe, it, expect } from 'vitest';
import type { TradingPair, PlaceOrderRequest, OrderBook } from './types';

describe('trading types', () => {
  it('compiles with representative values', () => {
    const pair: TradingPair = {
      id: 'p1', symbol: 'BTC/USDT', baseAssetId: 'b1', quoteAssetId: 'q1',
      baseSymbol: 'BTC', quoteSymbol: 'USDT', status: 'active',
      minOrderAmount: '0.0001', maxOrderAmount: null, pricePrecision: 2, quantityPrecision: 8,
      makerFeePercent: '0.1', takerFeePercent: '0.1', lastPrice: '65000',
    };
    const req: PlaceOrderRequest = { tradingPairId: 'p1', orderType: 'limit', side: 'buy', quantity: '0.5', price: '64000' };
    const book: OrderBook = { bids: [{ price: 64000, quantity: 1, total: 64000, orders: 2 }], asks: [], timestamp: '' };
    expect(pair.status).toBe('active');
    expect(req.side).toBe('buy');
    expect(book.bids[0].price).toBe(64000);
  });
});
