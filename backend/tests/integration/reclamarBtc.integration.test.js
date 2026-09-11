require('../helpers/testEnv');
const { sequelize, UserBalance } = require('../../models');
const { resetDb } = require('../helpers/db');
const f = require('../helpers/factories');

beforeEach(resetDb);
afterAll(async () => { await sequelize.close(); });

// Cubre AUDITORIA_BACKEND.md Críticos #12 (faucet de testnet de una sola vez).
// Post write-flip (Paso B): claimFreeBtc lee el saldo previo de la
// proyeccion del ledger (getByUserId) y acredita via updateBalance, que postea
// al ledger. Se prueba end-to-end contra el modelo real (con el grafo de
// ledger) y la DB de integracion — la version vieja armaba un sequelize local
// con solo 2 modelos y ya no puede resolver el postingService.
describe('UserBalance.claimFreeBtc (ledger-backed)', () => {
  test('un usuario sin saldo previo sí puede reclamar 1 BTC (acreditado en el ledger)', async () => {
    const btc = await f.seedCripto('BTC');
    const user = await f.seedUser();

    const resultado = await UserBalance.claimFreeBtc(user.id);

    expect(resultado.success).toBe(true);
    expect(resultado.balance.availableBalance).toBe('1.00000000');
    const b = await UserBalance.getByUserAndCrypto(user.id, btc.id);
    expect(b.availableBalance).toBe('1.00000000');
  });

  test('un usuario que ya tiene balance (en el ledger) no puede reclamar de nuevo', async () => {
    const btc = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, btc, '0.5'); // balance previo en el ledger

    await expect(UserBalance.claimFreeBtc(user.id)).rejects.toThrow(/solo para usuarios nuevos/i);
  });
});
