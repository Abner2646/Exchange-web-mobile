require('../helpers/testEnv');
const { sequelize, BalanceUsuario } = require('../../models');
const { resetDb } = require('../helpers/db');
const f = require('../helpers/factories');

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
});
