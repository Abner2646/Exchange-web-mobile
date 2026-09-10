// Covers AUDITORIA_BACKEND.md Críticos #9: the User↔BalanceUsuario,
// User↔DireccionDeposito and User↔TransaccionBlockchain associations were
// declared with foreignKey: 'usuarioId', but the real column in all three
// tables is user_id (userId in the model). Sequelize synthesized a phantom
// column that was never populated, so User.findByPk(id, { include: [...] })
// silently returned an empty array for those three relations — no error thrown,
// which is exactly what made it dangerous.
//
// A real integration test (real Postgres) on purpose: the bug is specifically
// about how Sequelize builds the JOIN against real columns — a mock cannot
// demonstrate it. Runs on the shared integration harness.

require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const {
  User, Criptomoneda, DireccionDeposito,
  TransaccionBlockchain, WalletMaestra,
} = require('../../models');

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

describe('Usuario associations -> direccionesDeposito / transaccionesBlockchain', () => {
  // (Paso C: el test de User.include('balances') se retiró — BalanceUsuario ya
  // no es un modelo Sequelize; los saldos viven en el ledger, no en una asociación.)

  test("Usuario.include('direccionesDeposito') returns the real address", async () => {
    const user = await User.create({ email: 'direcciones@test.com', username: 'direcciones_user', passwordHash: 'x', role: 'normal' });
    const cripto = await Criptomoneda.create({ symbol: 'ETH', nombre: 'Ethereum', red: 'ethereum', decimales: 18 });
    const wallet = await WalletMaestra.create({
      criptomonedaId: cripto.id, nombre: 'ETH master', red: 'ethereum', symbol: 'ETH',
      direccionPublica: '0xmaster', xpub: 'ethxpubtest123',
    });
    await DireccionDeposito.create({
      userId: user.id, criptomonedaId: cripto.id, walletMaestraId: wallet.id,
      direccion: '0xabc', derivationIndex: 0, derivationPath: "m/44'/60'/0'/0/0",
    });

    const withDirs = await User.findByPk(user.id, { include: [{ association: 'direccionesDeposito' }] });

    expect(withDirs.direccionesDeposito).toHaveLength(1);
    expect(withDirs.direccionesDeposito[0].direccion).toBe('0xabc');
  });

  test("Usuario.include('transaccionesBlockchain') returns the real transaction", async () => {
    const user = await User.create({ email: 'tx@test.com', username: 'tx_user', passwordHash: 'x', role: 'normal' });
    const cripto = await Criptomoneda.create({ symbol: 'USDT', nombre: 'Tether', red: 'ethereum', decimales: 6 });
    await TransaccionBlockchain.create({
      userId: user.id, criptomonedaId: cripto.id, tipo: 'deposito',
      cantidad: 100, direccionDestino: '0xabc', estado: 'pendiente',
    });

    const withTx = await User.findByPk(user.id, { include: [{ association: 'transaccionesBlockchain' }] });

    expect(withTx.transaccionesBlockchain).toHaveLength(1);
  });
});
