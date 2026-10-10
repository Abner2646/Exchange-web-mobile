import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/shared/api', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
import { apiClient } from '@/shared/api';
import { tradingApi } from './api';

describe('tradingApi reads', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getPairs normalizes symbol + drops non-active', async () => {
    (apiClient.get as any).mockResolvedValue({ success: true, pairs: [
      { id: 'p1', symbol: 'BTC/USDT', baseAssetId: 'b1', quoteAssetId: 'q1', status: 'active',
        minOrderAmount: '0.0001', maxOrderAmount: null, pricePrecision: 2, quantityPrecision: 8,
        makerFeePercent: '0.1', takerFeePercent: '0.1', lastPrice: '65000' },
      { id: 'p2', symbol: 'ETH/USDT', baseAssetId: 'b2', quoteAssetId: 'q2', status: 'paused',
        minOrderAmount: '0.001', maxOrderAmount: null, pricePrecision: 2, quantityPrecision: 8,
        makerFeePercent: '0.1', takerFeePercent: '0.1', lastPrice: '3200' },
    ]});
    const pairs = await tradingApi.getPairs();
    expect(apiClient.get).toHaveBeenCalledWith('/trading/pairs');
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ id: 'p1', baseSymbol: 'BTC', quoteSymbol: 'USDT' });
  });

  it('getOrderBook unwraps the envelope', async () => {
    (apiClient.get as any).mockResolvedValue({ success: true, orderBook: { bids: [], asks: [], timestamp: 't' } });
    const book = await tradingApi.getOrderBook('p1');
    expect(apiClient.get).toHaveBeenCalledWith('/trading/orderbook/p1');
    expect(book).toEqual({ bids: [], asks: [], timestamp: 't' });
  });

  it('getRecentTrades normalizes to an array', async () => {
    (apiClient.get as any).mockResolvedValue({ success: true, trades: [{ id: 't1', price: 1, quantity: 2, side: 'buy' }] });
    const trades = await tradingApi.getRecentTrades('p1');
    expect(apiClient.get).toHaveBeenCalledWith('/trading/trades/p1');
    expect(trades).toHaveLength(1);
  });
});
