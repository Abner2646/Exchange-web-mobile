import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/shared/api', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
import { apiClient } from '@/shared/api';
import { swapApi } from './api';

describe('swapApi.checkLimit', () => {
  beforeEach(() => vi.clearAllMocks());
  it('POSTs /check-limit with quoteAmount as a NUMBER (advisory boundary)', async () => {
    (apiClient.post as any).mockResolvedValue({ canTransact: true, remainingLimit: 900, limit: 1000, dailyVolume: 100, requestedAmount: 50 });
    await swapApi.checkLimit('50.5');
    const [url, body] = (apiClient.post as any).mock.calls[0];
    expect(url).toBe('/intercambioExchange/check-limit');
    expect(body).toEqual({ quoteAmount: 50.5 });
    expect(typeof body.quoteAmount).toBe('number');
  });
});
