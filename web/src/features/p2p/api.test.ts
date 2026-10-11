import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/shared/api';
import { p2pApi } from './api';

vi.mock('@/shared/api', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;
const mockPost = apiClient.post as unknown as ReturnType<typeof vi.fn>;
const mockPatch = apiClient.patch as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe('p2pApi paths + shapes', () => {
  it('getActiveOffers unwraps the { data } envelope and hits the legacy path', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 'o1' }], pagination: { total: 1 } });
    const offers = await p2pApi.getActiveOffers();
    expect(mockGet).toHaveBeenCalledWith('/ofertaP2P/activas');
    expect(offers).toEqual([{ id: 'o1' }]);
  });

  it('getActiveOffers tolerates a bare array', async () => {
    mockGet.mockResolvedValue([{ id: 'o2' }]);
    expect(await p2pApi.getActiveOffers()).toEqual([{ id: 'o2' }]);
  });

  it('acceptOffer sends amount as a STRING to /transaccionP2P and returns data', async () => {
    mockPost.mockResolvedValue({ message: 'ok', data: { id: 't1', status: 'initiated' } });
    const tx = await p2pApi.acceptOffer({ offerId: 'o1', amount: '1.5', paymentMethodId: 'pm1' });
    expect(mockPost).toHaveBeenCalledWith('/transaccionP2P', {
      offerId: 'o1', amount: '1.5', paymentMethodId: 'pm1',
    });
    const body = mockPost.mock.calls[0][1];
    expect(typeof body.amount).toBe('string');
    expect(tx).toEqual({ id: 't1', status: 'initiated' });
  });

  it('createOffer sends canonical string money fields', async () => {
    mockPost.mockResolvedValue({ id: 'o9' });
    await p2pApi.createOffer({
      type: 'sell', cryptoId: 'c1', minAmount: '0.01', maxAmount: '2', unitPrice: '65000.0000',
      fiatCurrency: 'USD', metodosPagoIds: ['pm1'], direccionFiat: 'acct-123',
    });
    const body = mockPost.mock.calls[0][1];
    expect(mockPost.mock.calls[0][0]).toBe('/ofertaP2P');
    for (const k of ['minAmount', 'maxAmount', 'unitPrice']) expect(typeof body[k]).toBe('string');
  });

  it('state-machine actions PATCH the right paths', async () => {
    mockPatch.mockResolvedValue({ message: 'ok', data: { id: 't1' } });
    await p2pApi.confirmPayment('t1');
    await p2pApi.completeTransaction('t1');
    await p2pApi.cancelTransaction('t1');
    expect(mockPatch).toHaveBeenNthCalledWith(1, '/transaccionP2P/t1/confirm-payment');
    expect(mockPatch).toHaveBeenNthCalledWith(2, '/transaccionP2P/t1/complete');
    expect(mockPatch).toHaveBeenNthCalledWith(3, '/transaccionP2P/t1/cancel');
  });

  it('getMyTransactions returns the { transacciones } envelope', async () => {
    mockGet.mockResolvedValue({ transacciones: [{ id: 't1', esComprador: true }], total: 1, page: 1, limit: 10 });
    const r = await p2pApi.getMyTransactions();
    expect(mockGet).toHaveBeenCalledWith('/transaccionP2P/me/transacciones');
    expect(r.transacciones[0].esComprador).toBe(true);
  });
});
