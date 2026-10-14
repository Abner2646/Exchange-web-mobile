import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/shared/api', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
import { apiClient } from '@/shared/api';
import { swapApi } from './api';

describe('swapApi.executeSwap', () => {
  beforeEach(() => vi.clearAllMocks());
  it('POSTs /intercambioExchange with baseAmount STRING + compartimento', async () => {
    (apiClient.post as any).mockResolvedValue({ message: 'ok', data: { precioUsado: '65000' } });
    await swapApi.executeSwap({ pairId: 'p1', type: 'buy', baseAmount: '0.5', compartimento: 'spot' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/intercambioExchange',
      { pairId: 'p1', type: 'buy', baseAmount: '0.5', compartimento: 'spot' },
      { idempotencyKey: undefined },
    );
    expect(typeof (apiClient.post as any).mock.calls[0][1].baseAmount).toBe('string');
  });

  it('forwards the idempotency key to the transport when supplied', async () => {
    (apiClient.post as any).mockResolvedValue({ message: 'ok', data: {} });
    await swapApi.executeSwap({ pairId: 'p1', type: 'buy', baseAmount: '0.5', compartimento: 'spot' }, 'key-abc');
    expect((apiClient.post as any).mock.calls[0][2]).toEqual({ idempotencyKey: 'key-abc' });
  });
});
