import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/shared/api', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
import { apiClient } from '@/shared/api';
import { tradingApi } from './api';

describe('tradingApi orders', () => {
  beforeEach(() => vi.clearAllMocks());
  it('getActiveOrders unwraps { orders }', async () => {
    (apiClient.get as any).mockResolvedValue({ success: true, orders: [{ id: 'o1', status: 'open' }], total: 1 });
    const orders = await tradingApi.getActiveOrders();
    expect(apiClient.get).toHaveBeenCalledWith('/trading/orders/active');
    expect(orders).toHaveLength(1);
  });
  it('cancelOrder DELETEs by id', async () => {
    (apiClient.delete as any).mockResolvedValue({ success: true, message: 'ok' });
    await tradingApi.cancelOrder('o1');
    expect(apiClient.delete).toHaveBeenCalledWith('/trading/orders/o1');
  });
});
