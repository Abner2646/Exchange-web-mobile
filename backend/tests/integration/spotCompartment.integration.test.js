require('../helpers/testEnv');
const { installAuthHarness } = require('../helpers/authHarness');
const f = require('../helpers/factories');
const balanceManager = require('../../services/trading/balanceManager.service');
const { BalanceUsuario } = require('../../models');
const recon = require('../../services/ledger/reconciliation');

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
