import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/api', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
import { apiClient } from '@/shared/api';
import { swapApi } from './api';

describe('swapApi.getPairs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GETs /parExchange and normalizes symbols + drops null-crypto pairs', async () => {
    (apiClient.get as any).mockResolvedValue([
      { id: 'p1', baseCryptoId: 'b1', quoteCryptoId: 'q1', currentPrice: '65000', feePercent: '0.1',
        active: true, oraclePaused: false,
        baseCrypto: { id: 'b1', symbol: 'BTC', name: 'Bitcoin', network: 'bitcoin' },
        quoteCrypto: { id: 'q1', symbol: 'USDT', name: 'Tether', network: 'ethereum' } },
      { id: 'p2', baseCryptoId: 'b2', quoteCryptoId: 'q2', currentPrice: '0', feePercent: '0.1',
        active: true, oraclePaused: false, baseCrypto: null, quoteCrypto: null },
    ]);
    const pairs = await swapApi.getPairs();
    expect(apiClient.get).toHaveBeenCalledWith('/parExchange');
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ id: 'p1', baseSymbol: 'BTC', quoteSymbol: 'USDT' });
  });
});
