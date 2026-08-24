// Covers AUDITORIA_BACKEND.md Críticos #9: the Usuario↔BalanceUsuario,
// Usuario↔DireccionDeposito and Usuario↔TransaccionBlockchain associations were
// declared with foreignKey: 'usuarioId', but the real column in all three
// tables is user_id (userId in the model). Sequelize synthesized a phantom
// column that was never populated, so Usuario.findByPk(id, { include: [...] })
// silently returned an empty array for those three relations — no error thrown,
// which is exactly what made it dangerous.
//
// A real integration test (real Postgres) on purpose: the bug is specifically
// about how Sequelize builds the JOIN against real columns — a mock cannot
// demonstrate it. Runs on the shared integration harness.

require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const {
  Usuario, BalanceUsuario, Criptomoneda, DireccionDeposito,
  TransaccionBlockchain, WalletMaestra,
} = require('../../models');

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

describe('Usuario associations -> balances / direccionesDeposito / transaccionesBlockchain', () => {
  test("Usuario.include('balances') returns the real balance, not an empty array", async () => {
    const user = await Usuario.create({ email: 'balances@test.com', username: 'balances_user', passwordHash: 'x', rol: 'normal' });
    const cripto = await Criptomoneda.create({ symbol: 'BTC', nombre: 'Bitcoin', red: 'bitcoin', decimales: 8 });
    await BalanceUsuario.create({ userId: user.id, criptomonedaId: cripto.id, balanceDisponible: 5, balanceBloqueado: 0 });

    const withBalances = await Usuario.findByPk(user.id, { include: [{ association: 'balances' }] });

    expect(withBalances.balances).toHaveLength(1);
    expect(withBalances.balances[0].balanceDisponible).toBe('5.00000000');
  });

  test("Usuario.include('direccionesDeposito') returns the real address", async () => {
    const user = await Usuario.create({ email: 'direcciones@test.com', username: 'direcciones_user', passwordHash: 'x', rol: 'normal' });
    const cripto = await Criptomoneda.create({ symbol: 'ETH', nombre: 'Ethereum', red: 'ethereum', decimales: 18 });
    const wallet = await WalletMaestra.create({
      criptomonedaId: cripto.id, nombre: 'ETH master', red: 'ethereum', symbol: 'ETH',
      direccionPublica: '0xmaster', xpub: 'ethxpubtest123',
    });
    await DireccionDeposito.create({
      userId: user.id, criptomonedaId: cripto.id, walletMaestraId: wallet.id,
      direccion: '0xabc', derivationIndex: 0, derivationPath: "m/44'/60'/0'/0/0",
    });

    const withDirs = await Usuario.findByPk(user.id, { include: [{ association: 'direccionesDeposito' }] });

    expect(withDirs.direccionesDeposito).toHaveLength(1);
    expect(withDirs.direccionesDeposito[0].direccion).toBe('0xabc');
  });

  test("Usuario.include('transaccionesBlockchain') returns the real transaction", async () => {
    const user = await Usuario.create({ email: 'tx@test.com', username: 'tx_user', passwordHash: 'x', rol: 'normal' });
    const cripto = await Criptomoneda.create({ symbol: 'USDT', nombre: 'Tether', red: 'ethereum', decimales: 6 });
    await TransaccionBlockchain.create({
      userId: user.id, criptomonedaId: cripto.id, tipo: 'deposito',
      cantidad: 100, direccionDestino: '0xabc', estado: 'pendiente',
    });

    const withTx = await Usuario.findByPk(user.id, { include: [{ association: 'transaccionesBlockchain' }] });

    expect(withTx.transaccionesBlockchain).toHaveLength(1);
  });
});
