require('../helpers/testEnv');
const { sequelize, BalanceUsuario } = require('../../models');
const { resetDb } = require('../helpers/db');
const f = require('../helpers/factories');

beforeEach(resetDb);
afterAll(async () => { await sequelize.close(); });

// Cubre AUDITORIA_BACKEND.md Críticos #12 (faucet de testnet de una sola vez).
// Post write-flip (Paso B): reclamarBtcGratis lee el saldo previo de la
// proyeccion del ledger (getByUserId) y acredita via updateBalance, que postea
// al ledger. Se prueba end-to-end contra el modelo real (con el grafo de
// ledger) y la DB de integracion — la version vieja armaba un sequelize local
// con solo 2 modelos y ya no puede resolver el postingService.
describe('BalanceUsuario.reclamarBtcGratis (ledger-backed)', () => {
  test('un usuario sin balance previo sí puede reclamar 1 BTC (acreditado en el ledger)', async () => {
    const btc = await f.seedCripto('BTC');
    const user = await f.seedUser();

    const resultado = await BalanceUsuario.reclamarBtcGratis(user.id);

    expect(resultado.success).toBe(true);
    expect(resultado.balance.balanceDisponible).toBe('1.00000000');
    const b = await BalanceUsuario.getByUserAndCrypto(user.id, btc.id);
    expect(b.balanceDisponible).toBe('1.00000000');
  });

  test('un usuario que ya tiene saldo (en el ledger) no puede reclamar de nuevo', async () => {
    const btc = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, btc, '0.5'); // saldo previo en el ledger

    await expect(BalanceUsuario.reclamarBtcGratis(user.id)).rejects.toThrow(/solo para usuarios nuevos/i);
  });
});
