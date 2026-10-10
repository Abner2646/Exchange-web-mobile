import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/shared/api', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
import { apiClient } from '@/shared/api';
import { swapApi } from './api';

describe('swapApi.getQuote', () => {
  beforeEach(() => vi.clearAllMocks());
  it('POSTs /intercambioExchange/calculate with baseAmount as a STRING', async () => {
    (apiClient.post as any).mockResolvedValue({ par: {}, calculo: {}, advertencias: [] });
    await swapApi.getQuote({ pairId: 'p1', baseAmount: '0.5', type: 'buy' });
    expect(apiClient.post).toHaveBeenCalledWith('/intercambioExchange/calculate', {
      pairId: 'p1', baseAmount: '0.5', type: 'buy',
    });
    const body = (apiClient.post as any).mock.calls[0][1];
    expect(typeof body.baseAmount).toBe('string');
  });
});
