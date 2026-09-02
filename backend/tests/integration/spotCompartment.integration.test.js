require('../helpers/testEnv');
const { installAuthHarness, app } = require('../helpers/authHarness');
const request = require('supertest');
const f = require('../helpers/factories');
const balanceManager = require('../../services/trading/balanceManager.service');
const { BalanceUsuario } = require('../../models');
const recon = require('../../services/ledger/reconciliation');
const { PROPOSITOS } = require('../../services/ledger/ledgerAccounts');
const posting = require('../../services/ledger/postingService');

installAuthHarness();

describe('Trading reserva y lee en el compartimento Spot', () => {
  test('lockBalanceForOrder falla si sólo hay saldo en Funding', async () => {
    const usdt = await f.seedCripto('USDT');
    const btc = await f.seedCripto('BTC');
    const pair = await f.seedTradingPair({ base: btc, quote: usdt });
    const user = await f.seedUser({ email: 'trader1@test.local', username: 'trader1' });
    await f.seedBalance(user, usdt, '1000'); // en Funding, NO en Spot

    const res = await balanceManager.lockBalanceForOrder({
      userId: user.id, tradingPair: pair, side: 'buy', quantity: '1', price: '100',
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/insuficiente/i);
  });

  test('con saldo en Spot, la reserva mueve spot:disponible → spot:bloqueado', async () => {
    const usdt = await f.seedCripto('USDT');
    const btc = await f.seedCripto('BTC');
    const pair = await f.seedTradingPair({ base: btc, quote: usdt });
    const user = await f.seedUser({ email: 'trader2@test.local', username: 'trader2' });
    await f.seedSpotBalance(user, usdt, '1000');

    const res = await balanceManager.lockBalanceForOrder({
      userId: user.id, tradingPair: pair, side: 'buy', quantity: '1', price: '100',
    });
    expect(res.success).toBe(true);

    const spot = await BalanceUsuario.getSaldoCompartimento(user.id, usdt.id, 'spot');
    expect(spot.disponible).toBe('900.00000000');
    expect(spot.bloqueado).toBe('100.00000000');
    // Funding intacto.
    const funding = await BalanceUsuario.getSaldoCompartimento(user.id, usdt.id, 'funding');
    expect(funding.disponible).toBe('0');
    expect((await recon.reconciliarInterno()).ok).toBe(true);
  });
});

describe('POST /api/balances/my/transfer (Funding↔Spot)', () => {
  test('funding→spot mueve fondos y el libro cierra', async () => {
    const usdt = await f.seedCripto('USDT');
    const user = await f.seedUser({ email: 'mover@test.local', username: 'mover' });
    await f.seedBalance(user, usdt, '500');

    const res = await request(app)
      .post('/api/balances/my/transfer')
      .set(f.authHeader(user))
      .send({ criptomonedaId: usdt.id, cantidad: '200', origen: 'funding', destino: 'spot' });
    expect(res.status).toBe(200);

    expect((await BalanceUsuario.getSaldoCompartimento(user.id, usdt.id, 'funding')).disponible).toBe('300.00000000');
    expect((await BalanceUsuario.getSaldoCompartimento(user.id, usdt.id, 'spot')).disponible).toBe('200.00000000');
    expect(await posting.getSaldoCuenta({ ownerId: null, proposito: PROPOSITOS.SUSPENSE, criptomonedaId: usdt.id })).toBe('0');
    expect((await recon.reconciliarInterno()).ok).toBe(true);
  });

  test('sobregiro → 400, sin mover fondos', async () => {
    const usdt = await f.seedCripto('USDT');
    const user = await f.seedUser({ email: 'poor@test.local', username: 'poor' });
    await f.seedBalance(user, usdt, '10');

    const res = await request(app)
      .post('/api/balances/my/transfer')
      .set(f.authHeader(user))
      .send({ criptomonedaId: usdt.id, cantidad: '200', origen: 'funding', destino: 'spot' });
    expect(res.status).toBe(400);
    expect((await BalanceUsuario.getSaldoCompartimento(user.id, usdt.id, 'funding')).disponible).toBe('10.00000000');
  });

  test('mismo compartimento → 400', async () => {
    const usdt = await f.seedCripto('USDT');
    const user = await f.seedUser({ email: 'same@test.local', username: 'same' });
    await f.seedBalance(user, usdt, '10');
    const res = await request(app)
      .post('/api/balances/my/transfer')
      .set(f.authHeader(user))
      .send({ criptomonedaId: usdt.id, cantidad: '1', origen: 'funding', destino: 'funding' });
    expect(res.status).toBe(400);
  });
});
