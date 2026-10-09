import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { walletApi } from './api';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );
}

describe('walletApi contract', () => {
  it('getBalances GETs /balances/my/balances and returns the raw array', async () => {
    fetchMock.mockReturnValueOnce(jsonResponse([{ criptomonedaId: 'c1', availableBalance: '1' }]));
    const out = await walletApi.getBalances();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/balances/my/balances');
    expect(opts.method).toBe('GET');
    expect(Array.isArray(out)).toBe(true);
    expect(out[0].criptomonedaId).toBe('c1');
  });

  it('transferCompartments POSTs the English body {cryptoId,amount,from,to} with an Idempotency-Key', async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ message: 'ok', data: { from: 'funding', to: 'spot' } }));
    await walletApi.transferCompartments({ cryptoId: 'c1', amount: '10', from: 'funding', to: 'spot' });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/balances/my/transfer');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ cryptoId: 'c1', amount: '10', from: 'funding', to: 'spot' });
    expect(new Headers(opts.headers).get('Idempotency-Key')).toBeTruthy();
  });

  it('getDepositAddress GETs the per-crypto path and unwraps data', async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse({ success: true, data: { address: 'bc1xyz', qrCode: 'BTC:bc1xyz', crypto: { symbol: 'BTC' } } }),
    );
    const out = await walletApi.getDepositAddress('c1');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/transaccionBlockchain/deposit-address/c1');
    expect(opts.method).toBe('GET');
    expect(out.address).toBe('bc1xyz');
    expect(out.qrCode).toBe('BTC:bc1xyz');
  });

  it('withdraw POSTs {cryptoId,amount,destinationAddress} with an Idempotency-Key and unwraps data', async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse({ success: true, message: 'ok', data: { id: 't1', status: 'pending', type: 'withdrawal' } }, 201),
    );
    const out = await walletApi.withdraw({ cryptoId: 'c1', amount: '0.5', destinationAddress: 'bc1dest' });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/transaccionBlockchain/withdraw');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ cryptoId: 'c1', amount: '0.5', destinationAddress: 'bc1dest' });
    expect(new Headers(opts.headers).get('Idempotency-Key')).toBeTruthy();
    expect(out.id).toBe('t1');
    expect(out.status).toBe('pending');
  });

  it('getTransactions GETs /transaccionBlockchain/my and unwraps the data array', async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ success: true, data: [{ id: 't1', type: 'deposit' }] }));
    const out = await walletApi.getTransactions();
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/transaccionBlockchain/my');
    expect(out[0].id).toBe('t1');
  });
});
