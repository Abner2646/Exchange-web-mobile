require('../helpers/testEnv');
const { installAuthHarness, app } = require('../helpers/authHarness');
const request = require('supertest');
const f = require('../helpers/factories');
const balanceManager = require('../../services/trading/balanceManager.service');
const { BalanceUsuario } = require('../../models');
const recon = require('../../services/ledger/reconciliation');
const { PROPOSITOS } = require('../../services/ledger/ledgerAccounts');
const posting = require('../../services/ledger/postingService');
const money = require('../../utils/money');

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

describe('GET /api/balances/my/balances es aditivo (totales = suma + desglose)', () => {
  test('suma funding+spot en la raíz y expone compartimentos', async () => {
    const usdt = await f.seedCripto('USDT');
    const user = await f.seedUser({ email: 'shape@test.local', username: 'shape' });
    await f.seedBalance(user, usdt, '300');       // funding:disponible
    await f.seedSpotBalance(user, usdt, '200');    // spot:disponible

    const res = await request(app).get('/api/balances/my/balances').set(f.authHeader(user));
    expect(res.status).toBe(200);
    const fila = res.body.find((b) => b.criptomonedaId === usdt.id);
    expect(fila).toBeDefined();
    expect(fila.balanceDisponible).toBe('500.00000000'); // 300 + 200
    expect(fila.compartimentos.funding.disponible).toBe('300.00000000');
    expect(fila.compartimentos.spot.disponible).toBe('200.00000000');
  });

  test('caso mixto: solo funding — valores cero de spot deben tener 8 decimales', async () => {
    const usdt = await f.seedCripto('USDT2');
    const user = await f.seedUser({ email: 'mixto@test.local', username: 'mixto' });
    await f.seedBalance(user, usdt, '300'); // funding:disponible; sin saldo spot

    const res = await request(app).get('/api/balances/my/balances').set(f.authHeader(user));
    expect(res.status).toBe(200);
    const fila = res.body.find((b) => b.criptomonedaId === usdt.id);
    expect(fila).toBeDefined();
    // root: 300 funding + 0 spot = 300, siempre 8dp
    expect(fila.balanceDisponible).toBe('300.00000000');
    // funding compartimento: valor real, 8dp
    expect(fila.compartimentos.funding.disponible).toBe('300.00000000');
    expect(fila.compartimentos.funding.bloqueado).toBe('0.00000000');
    expect(fila.compartimentos.funding.pendiente).toBe('0.00000000');
    // root pendiente: 8dp (no bare '0')
    expect(fila.balancePendiente).toBe('0.00000000');
    // spot compartimento: sin cuenta → getSaldoCuenta devuelve '0' → debe emitirse como '0.00000000'
    expect(fila.compartimentos.spot.disponible).toBe('0.00000000');
    expect(fila.compartimentos.spot.bloqueado).toBe('0.00000000');
  });
});

// Task 9: swap endpoint acepta compartimento fuente (funding|spot).
// BTC/USDT, precio 100, comision 1%. Compra 1 BTC desde Spot:
//   cantidadQuote = 1 * 100    = 100
//   comision      = 100 * 1%   = 1
//   requiredQuote = 100 + 1    = 101
describe('Swap respeta el compartimento origen', () => {
  test("compartimento 'spot': debita/acredita Spot, Funding intacto", async () => {
    const btc = await f.seedCripto('BTC');
    const usdt = await f.seedCripto('USDT');
    await f.seedWalletMaestra(btc);
    await f.seedWalletMaestra(usdt);
    const par = await f.seedPar({ base: btc, quote: usdt, precio: '100', comision: '1' });
    const user = await f.seedUser({ email: 'swapspot@test.local', username: 'swapspot' });
    await f.seedSpotBalance(user, usdt, '200'); // 200 USDT en Spot, cubre los 101 requeridos

    const res = await request(app)
      .post('/api/intercambioExchange/')
      .set(f.authHeader(user))
      .send({ parId: par.id, tipo: 'compra', cantidadBase: 1, compartimento: 'spot' });
    expect(res.status).toBe(201);

    // Recibió BTC en Spot (no en Funding)
    const spotBtc = await BalanceUsuario.getSaldoCompartimento(user.id, btc.id, 'spot');
    expect(money.compare(spotBtc.disponible, '0')).toBeGreaterThan(0);

    // Pagó USDT desde Spot (200 - 101 = 99)
    const spotUsdt = await BalanceUsuario.getSaldoCompartimento(user.id, usdt.id, 'spot');
    expect(spotUsdt.disponible).toBe('99.00000000');

    // Funding completamente intacto (cero en ambas criptos)
    const fundingBtc = await BalanceUsuario.getSaldoCompartimento(user.id, btc.id, 'funding');
    expect(fundingBtc.disponible).toBe('0');
    const fundingUsdt = await BalanceUsuario.getSaldoCompartimento(user.id, usdt.id, 'funding');
    expect(fundingUsdt.disponible).toBe('0');
  });
});
