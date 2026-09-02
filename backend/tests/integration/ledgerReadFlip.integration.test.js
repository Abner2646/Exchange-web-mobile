require('../helpers/testEnv');
const { sequelize, BalanceUsuario } = require('../../models');
const { resetDb } = require('../helpers/db');
const f = require('../helpers/factories');

beforeEach(resetDb);
afterAll(async () => { await sequelize.close(); });

// Los métodos de lectura de saldo leen la PROYECCIÓN del ledger (compartimento
// Funding). balances_users se eliminó (Paso C), así que ya no hay una tabla
// legacy contra la cual "divergir" — se asevera directamente el valor del ledger.
describe('read: getTotalBalance + hasAvailableBalance from the ledger projection', () => {
  test('getTotalBalance reflects ledger balances (disponible + bloqueado)', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '10');
    await BalanceUsuario.blockBalance(user.id, cripto.id, '4.00000000');

    const total = await BalanceUsuario.getTotalBalance(user.id, cripto.id);
    expect(total.disponible).toBe('6.00000000');
    expect(total.bloqueado).toBe('4.00000000');
    expect(total.total).toBe('10'); // money.add sin escala fija
  });

  test('hasAvailableBalance uses the ledger disponible', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '5');
    expect(await BalanceUsuario.hasAvailableBalance(user.id, cripto.id, '5.00000000')).toBe(true);
    expect(await BalanceUsuario.hasAvailableBalance(user.id, cripto.id, '5.00000001')).toBe(false);
  });
});

describe('read: getByUserAndCrypto / getByUserId from the ledger projection', () => {
  test('getByUserAndCrypto returns the ledger balance as an object', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '8');
    await BalanceUsuario.blockBalance(user.id, cripto.id, '3.00000000');

    const b = await BalanceUsuario.getByUserAndCrypto(user.id, cripto.id);
    expect(b.balanceDisponible).toBe('5.00000000');
    expect(b.balanceBloqueado).toBe('3.00000000');
    expect(b.userId).toBe(user.id);
    expect(b.criptomonedaId).toBe(cripto.id);
  });

  test('getByUserAndCrypto returns a zero object when the account does not exist', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    const b = await BalanceUsuario.getByUserAndCrypto(user.id, cripto.id);
    expect(b.balanceDisponible).toBe('0');
    expect(b.balanceBloqueado).toBe('0');
  });

  test('getByUserId aggregates the ledger funding balances per crypto (no zero rows)', async () => {
    const btc = await f.seedCripto('BTC');
    const usdt = await f.seedCripto('USDT');
    const eth = await f.seedCripto('ETH');
    const user = await f.seedUser();
    await f.seedBalance(user, btc, '2');
    await f.seedBalance(user, usdt, '100');
    // ETH sin movimiento en el ledger → no aparece (no hay cuenta con saldo 0).

    const balances = await BalanceUsuario.getByUserId(user.id);
    const porCripto = Object.fromEntries(balances.map((b) => [b.criptomonedaId, b.balanceDisponible]));
    expect(balances).toHaveLength(2);
    expect(porCripto[btc.id]).toBe('2.00000000');
    expect(porCripto[usdt.id]).toBe('100.00000000');
    expect(porCripto[eth.id]).toBeUndefined();
  });
});

describe('read: admin aggregates and the reclaimBtc check from the ledger', () => {
  test('getUsersWithBalance lists users with a positive ledger funding balance', async () => {
    const cripto = await f.seedCripto('BTC');
    const withBalance = await f.seedUser();
    await f.seedBalance(withBalance, cripto, '5');
    const withoutBalance = await f.seedUser(); // sin saldo

    const rows = await BalanceUsuario.getUsersWithBalance(cripto.id, '0');
    const userIds = rows.map((r) => r.userId);
    expect(userIds).toContain(withBalance.id);
    expect(userIds).not.toContain(withoutBalance.id);
  });

  test('getBalanceStats aggregates the ledger Funding projection', async () => {
    const btc = await f.seedCripto('BTC');
    const u1 = await f.seedUser();
    const u2 = await f.seedUser();
    await f.seedBalance(u1, btc, '2');
    await f.seedBalance(u2, btc, '3');

    const stats = await BalanceUsuario.getBalanceStats();
    const btcStat = stats.find((s) => s.criptomonedaId === btc.id);
    expect(btcStat.totalUsers).toBe(2);
    expect(btcStat.totalDisponible).toBe('5'); // money.add sin escala fija
  });

  test('reclamarBtcGratis is blocked when the ledger shows a balance', async () => {
    const btc = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, btc, '1'); // saldo en el ledger

    await expect(BalanceUsuario.reclamarBtcGratis(user.id)).rejects.toThrow(/ya tienes saldo/i);
  });
});
