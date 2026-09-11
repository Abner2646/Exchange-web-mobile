// Covers AUDITORIA_BACKEND.md Críticos #9: the User↔UserBalance,
// User↔DepositAddress and User↔BlockchainTransaction associations were
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
  User, Crypto, DepositAddress,
  BlockchainTransaction, MasterWallet,
} = require('../../models');

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

describe('Usuario associations -> depositAddresses / blockchainTransactions', () => {
  // (Paso C: el test de User.include('balances') se retiró — UserBalance ya
  // no es un modelo Sequelize; los saldos viven en el ledger, no en una asociación.)

  test("Usuario.include('depositAddresses') returns the real address", async () => {
    const user = await User.create({ email: 'direcciones@test.com', username: 'direcciones_user', passwordHash: 'x', role: 'normal' });
    const cripto = await Crypto.create({ symbol: 'ETH', name: 'Ethereum', network: 'ethereum', decimals: 18 });
    const wallet = await MasterWallet.create({
      cryptoId: cripto.id, name: 'ETH master', network: 'ethereum', symbol: 'ETH',
      publicAddress: '0xmaster', xpub: 'ethxpubtest123',
    });
    await DepositAddress.create({
      userId: user.id, cryptoId: cripto.id, masterWalletId: wallet.id,
      address: '0xabc', derivationIndex: 0, derivationPath: "m/44'/60'/0'/0/0",
    });

    const withDirs = await User.findByPk(user.id, { include: [{ association: 'depositAddresses' }] });

    expect(withDirs.depositAddresses).toHaveLength(1);
    expect(withDirs.depositAddresses[0].address).toBe('0xabc');
  });

  test("Usuario.include('blockchainTransactions') returns the real transaction", async () => {
    const user = await User.create({ email: 'tx@test.com', username: 'tx_user', passwordHash: 'x', role: 'normal' });
    const cripto = await Crypto.create({ symbol: 'USDT', name: 'Tether', network: 'ethereum', decimals: 6 });
    await BlockchainTransaction.create({
      userId: user.id, cryptoId: cripto.id, type: 'deposit',
      amount: 100, destinationAddress: '0xabc', status: 'pending',
    });

    const withTx = await User.findByPk(user.id, { include: [{ association: 'blockchainTransactions' }] });

    expect(withTx.blockchainTransactions).toHaveLength(1);
  });
});
