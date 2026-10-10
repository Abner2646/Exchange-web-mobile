import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/shared/api', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
import { apiClient } from '@/shared/api';
import { tradingApi } from './api';

describe('tradingApi.placeOrder', () => {
  beforeEach(() => vi.clearAllMocks());
  it('POSTs /trading/orders with quantity+price as STRINGS (limit buy)', async () => {
    (apiClient.post as any).mockResolvedValue({ success: true, order: { id: 'o1' }, message: 'ok' });
    await tradingApi.placeOrder({ tradingPairId: 'p1', orderType: 'limit', side: 'buy', quantity: '0.5', price: '64000' });
    expect(apiClient.post).toHaveBeenCalledWith('/trading/orders', {
      tradingPairId: 'p1', orderType: 'limit', side: 'buy', quantity: '0.5', price: '64000',
    });
    const body = (apiClient.post as any).mock.calls[0][1];
    expect(typeof body.quantity).toBe('string');
    expect(typeof body.price).toBe('string');
  });
  it('omits price for a market order', async () => {
    (apiClient.post as any).mockResolvedValue({ success: true, order: { id: 'o2' }, message: 'ok' });
    await tradingApi.placeOrder({ tradingPairId: 'p1', orderType: 'market', side: 'sell', quantity: '1' });
    const body = (apiClient.post as any).mock.calls[0][1];
    expect('price' in body).toBe(false);
  });
});
