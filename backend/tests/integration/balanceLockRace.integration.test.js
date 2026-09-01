// Covers AUDITORIA_BACKEND.md Críticos #5: BalanceUsuario.blockBalance did
// findOne() + save() with no transaction or lock — two near-simultaneous
// requests could read the same balance, both pass validation, and block more
// in aggregate than the user actually holds.
//
// A real integration test (real Postgres, concurrent connections) on purpose:
// a mock cannot prove that SELECT ... FOR UPDATE serializes two transactions —
// that needs a real database. Runs on the shared integration harness.

require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const { BalanceUsuario } = require('../../models');
const f = require('../helpers/factories');

let user, cripto;

beforeEach(async () => {
  await resetDb();
  user = await f.seedUser();
  cripto = await f.seedCripto('BTC');
  await f.seedBalance(user, cripto, '100');
});

afterAll(async () => { await sequelize.close(); });

describe('BalanceUsuario.blockBalance under concurrency (real Postgres)', () => {
  test('two concurrent 80-blocks over a 100 balance: only one may pass', async () => {
    const results = await Promise.allSettled([
      BalanceUsuario.blockBalance(user.id, cripto.id, 80),
      BalanceUsuario.blockBalance(user.id, cripto.id, 80),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Before the fix: both could be fulfilled (a real double-spend).
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.message).toMatch(/insuficiente/i);

    // Write-flip: el saldo autoritativo sale del ledger (blockBalance ya no
    // escribe balances_users). La serializacion la da el FOR UPDATE de
    // postTransaction sobre la fila de proyeccion.
    const finalBalance = await BalanceUsuario.getByUserAndCrypto(user.id, cripto.id);
    expect(finalBalance.balanceDisponible).toBe('20.00000000');
    expect(finalBalance.balanceBloqueado).toBe('80.00000000');
  }, 15000);

  test('ten concurrent 15-blocks over a 100 balance: at most 6 pass, never negative', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => BalanceUsuario.blockBalance(user.id, cripto.id, 15))
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBeLessThanOrEqual(6); // 6 * 15 = 90 <= 100 < 7 * 15 = 105

    const finalBalance = await BalanceUsuario.getByUserAndCrypto(user.id, cripto.id);
    expect(parseFloat(finalBalance.balanceDisponible)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(finalBalance.balanceBloqueado)).toBe(fulfilled.length * 15);
  }, 15000);
});
