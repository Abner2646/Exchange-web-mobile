require('../helpers/testEnv');
const { sequelize, BalanceUsuario } = require('../../models');
const { resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const posting = require('../../services/ledger/postingService');
const { PROPOSITOS } = require('../../services/ledger/ledgerAccounts');

beforeEach(resetDb);
afterAll(async () => { await sequelize.close(); });

// Plan 3 (read-flip): getTotalBalance y hasAvailableBalance leen de la
// proyeccion del ledger, no de balances_users. Se prueba por DIVERGENCIA: se
// escribe balances_users con hooks:false (el mirror no dispara → el ledger
// queda distinto) y se verifica que el metodo devuelve el valor del LEDGER.
describe('read-flip: getTotalBalance + hasAvailableBalance read the ledger projection', () => {
  test('getTotalBalance returns the LEDGER value, not balances_users (divergence proof)', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    // Legacy row says 99 but the ledger has nothing (hooks:false skips the mirror).
    await BalanceUsuario.create(
      { userId: user.id, criptomonedaId: cripto.id, balanceDisponible: '99.00000000', balanceBloqueado: '7.00000000' },
      { hooks: false }
    );

    const total = await BalanceUsuario.getTotalBalance(user.id, cripto.id);
    expect(total.disponible).toBe('0'); // from the ledger, NOT the 99 in balances_users
    expect(total.bloqueado).toBe('0');
    expect(total.total).toBe('0');
  });

  test('getTotalBalance reflects real ledger balances after mirrored writes', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await BalanceUsuario.create({ userId: user.id, criptomonedaId: cripto.id, balanceDisponible: '10.00000000', balanceBloqueado: '0' });
    await BalanceUsuario.blockBalance(user.id, cripto.id, '4.00000000');

    const total = await BalanceUsuario.getTotalBalance(user.id, cripto.id);
    expect(total.disponible).toBe('6.00000000');
    expect(total.bloqueado).toBe('4.00000000');
    expect(total.total).toBe('10'); // money.add sin escala fija
  });

  test('hasAvailableBalance uses the LEDGER disponible, not balances_users (divergence proof)', async () => {
    const cripto = await f.seedCripto('BTC');
    // Divergence user: legacy says 5, ledger has nothing → cannot cover 1.
    const legacyUser = await f.seedUser();
    await BalanceUsuario.create(
      { userId: legacyUser.id, criptomonedaId: cripto.id, balanceDisponible: '5.00000000', balanceBloqueado: '0' },
      { hooks: false }
    );
    expect(await BalanceUsuario.hasAvailableBalance(legacyUser.id, cripto.id, '1.00000000')).toBe(false);

    // Real user: a mirrored credit from zero → ledger reflects 5.
    const realUser = await f.seedUser();
    await BalanceUsuario.create({ userId: realUser.id, criptomonedaId: cripto.id, balanceDisponible: '5.00000000', balanceBloqueado: '0' });
    expect(await BalanceUsuario.hasAvailableBalance(realUser.id, cripto.id, '5.00000000')).toBe(true);
    expect(await BalanceUsuario.hasAvailableBalance(realUser.id, cripto.id, '5.00000001')).toBe(false);
  });

  test('getByUserAndCrypto returns the LEDGER balance as an object (divergence proof)', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    // Legacy row says 99/7 but the ledger has nothing.
    await BalanceUsuario.create(
      { userId: user.id, criptomonedaId: cripto.id, balanceDisponible: '99.00000000', balanceBloqueado: '7.00000000' },
      { hooks: false }
    );

    const b = await BalanceUsuario.getByUserAndCrypto(user.id, cripto.id);
    expect(b.balanceDisponible).toBe('0'); // from the ledger, not 99
    expect(b.balanceBloqueado).toBe('0');
    expect(b.userId).toBe(user.id);
    expect(b.criptomonedaId).toBe(cripto.id);
  });

  test('getByUserAndCrypto reflects mirrored balances', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await BalanceUsuario.create({ userId: user.id, criptomonedaId: cripto.id, balanceDisponible: '8.00000000', balanceBloqueado: '0' });
    await BalanceUsuario.blockBalance(user.id, cripto.id, '3.00000000');

    const b = await BalanceUsuario.getByUserAndCrypto(user.id, cripto.id);
    expect(b.balanceDisponible).toBe('5.00000000');
    expect(b.balanceBloqueado).toBe('3.00000000');
  });

  test('getByUserId aggregates the ledger funding balances per crypto', async () => {
    const btc = await f.seedCripto('BTC');
    const usdt = await f.seedCripto('USDT');
    const user = await f.seedUser();
    await BalanceUsuario.create({ userId: user.id, criptomonedaId: btc.id, balanceDisponible: '2.00000000', balanceBloqueado: '0' });
    await BalanceUsuario.create({ userId: user.id, criptomonedaId: usdt.id, balanceDisponible: '100.00000000', balanceBloqueado: '0' });
    // A legacy zero-row (hooks:false) does NOT appear (no ledger movement).
    const eth = await f.seedCripto('ETH');
    await BalanceUsuario.create({ userId: user.id, criptomonedaId: eth.id, balanceDisponible: '0', balanceBloqueado: '0' }, { hooks: false });

    const balances = await BalanceUsuario.getByUserId(user.id);
    const porCripto = Object.fromEntries(balances.map((b) => [b.criptomonedaId, b.balanceDisponible]));
    expect(balances).toHaveLength(2);
    expect(porCripto[btc.id]).toBe('2.00000000');
    expect(porCripto[usdt.id]).toBe('100.00000000');
    expect(porCripto[eth.id]).toBeUndefined();
  });
});

describe('read-flip: admin aggregates and the reclaimBtc check read the ledger', () => {
  test('getUsersWithBalance reads the ledger projection, not balances_users (divergence proof)', async () => {
    const cripto = await f.seedCripto('BTC');
    const real = await f.seedUser();
    await f.seedBalance(real, cripto, '5'); // mirrored → ledger funding:disponible = 5
    const legacyOnly = await f.seedUser();
    await BalanceUsuario.create(
      { userId: legacyOnly.id, criptomonedaId: cripto.id, balanceDisponible: '9.00000000', balanceBloqueado: '0' },
      { hooks: false } // ledger knows nothing about this row
    );

    const rows = await BalanceUsuario.getUsersWithBalance(cripto.id, '0');
    const userIds = rows.map((r) => r.userId);
    expect(userIds).toContain(real.id);
    expect(userIds).not.toContain(legacyOnly.id); // legacy-only row absent from the ledger view
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

  test('reclamarBtcGratis is blocked when the LEDGER shows a balance (divergence proof)', async () => {
    const btc = await f.seedCripto('BTC');
    const user = await f.seedUser();
    // Ledger has 1 BTC funding; balances_users shows 0 (hooks:false) → divergence.
    await posting.postTransaction({
      tipo: 'apertura', referencia: `recl:${Date.now()}`,
      lineas: [
        { ownerId: null, proposito: PROPOSITOS.APERTURA, criptomonedaId: btc.id, monto: '-1.00000000' },
        { ownerId: user.id, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: btc.id, monto: '1.00000000' },
      ],
    });
    await BalanceUsuario.create(
      { userId: user.id, criptomonedaId: btc.id, balanceDisponible: '0', balanceBloqueado: '0' },
      { hooks: false }
    );

    await expect(BalanceUsuario.reclamarBtcGratis(user.id)).rejects.toThrow(/ya tienes saldo/i);
  });
});
