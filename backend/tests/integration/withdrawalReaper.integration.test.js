require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const FakeEvmClient = require('../helpers/fakeEvmClient');
const { reapStaleWithdrawals } = require('../../services/blockchain/withdrawalReaper');
const { TransaccionBlockchain } = require('../../models');

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

async function seedEth() {
  const eth = await f.seedCripto('ETH');
  await eth.update({ red: 'sepolia' });
  return eth;
}

// Force a claimed ('procesando') withdrawal at a chosen age via raw SQL — Sequelize
// would otherwise bump updated_at to now on any managed update.
async function seedStuck(user, eth, { txHash = null, ageMinutes = 60 } = {}) {
  const w = await TransaccionBlockchain.createWithdrawal({
    userId: user.id, criptomonedaId: eth.id, cantidad: '1', direccionDestino: '0xrecipient0000000000000000000000000000dead',
  });
  const oldDate = new Date(Date.now() - ageMinutes * 60000);
  await sequelize.query(
    `UPDATE transacciones_blockchain SET estado='procesando', tx_hash=:txHash, updated_at=:d WHERE id=:id`,
    { replacements: { txHash, d: oldDate, id: w.id } }
  );
  return w;
}

const clientFor = (fake) => () => fake;

test('stuck with no txHash → reverted (never broadcast)', async () => {
  const user = await f.seedUser();
  const eth = await seedEth();
  await f.seedBalance(user, eth, '5');
  const w = await seedStuck(user, eth, { txHash: null });

  const res = await reapStaleWithdrawals({ getClientForNetwork: clientFor(new FakeEvmClient({})) });

  expect(res.reverted).toBe(1);
  const row = await TransaccionBlockchain.findByPk(w.id);
  expect(row.estado).toBe('fallido');
  expect((await f.getBalance(user, eth)).balanceDisponible).toBe('5.00000000');
});

test('stuck with txHash, tx absent on-chain → reverted', async () => {
  const user = await f.seedUser();
  const eth = await seedEth();
  await f.seedBalance(user, eth, '5');
  const w = await seedStuck(user, eth, { txHash: '0xabc' });

  await reapStaleWithdrawals({ getClientForNetwork: clientFor(new FakeEvmClient({ confirmations: null })) });

  const row = await TransaccionBlockchain.findByPk(w.id);
  expect(row.estado).toBe('fallido');
  expect((await f.getBalance(user, eth)).balanceDisponible).toBe('5.00000000');
});

test('stuck with txHash, tx present on-chain → left untouched', async () => {
  const user = await f.seedUser();
  const eth = await seedEth();
  await f.seedBalance(user, eth, '5');
  const w = await seedStuck(user, eth, { txHash: '0xabc' });

  const res = await reapStaleWithdrawals({ getClientForNetwork: clientFor(new FakeEvmClient({ confirmations: 2 })) });

  expect(res.left).toBe(1);
  const row = await TransaccionBlockchain.findByPk(w.id);
  expect(row.estado).toBe('procesando');
  expect((await f.getBalance(user, eth)).balanceBloqueado).toBe('1.00000000');
});

test('a tx in mempool (0 confirmations) is treated as present → left', async () => {
  const user = await f.seedUser();
  const eth = await seedEth();
  await f.seedBalance(user, eth, '5');
  const w = await seedStuck(user, eth, { txHash: '0xabc' });

  await reapStaleWithdrawals({ getClientForNetwork: clientFor(new FakeEvmClient({ confirmations: 0 })) });

  const row = await TransaccionBlockchain.findByPk(w.id);
  expect(row.estado).toBe('procesando'); // 0 confs = mempool = present, do not revert
});

test('getConfirmations throwing (transient error) → left untouched, never reverted', async () => {
  const user = await f.seedUser();
  const eth = await seedEth();
  await f.seedBalance(user, eth, '5');
  const w = await seedStuck(user, eth, { txHash: '0xabc' });

  const throwingClient = {
    async getConfirmations() { throw new Error('RPC timeout'); },
  };
  const res = await reapStaleWithdrawals({ getClientForNetwork: () => throwingClient });

  expect(res.reverted).toBe(0);
  const row = await TransaccionBlockchain.findByPk(w.id);
  expect(row.estado).toBe('procesando'); // never revert on a lookup error
});

test('not stale yet → skipped', async () => {
  const user = await f.seedUser();
  const eth = await seedEth();
  await f.seedBalance(user, eth, '5');
  const w = await seedStuck(user, eth, { txHash: null, ageMinutes: 1 });

  await reapStaleWithdrawals({ getClientForNetwork: clientFor(new FakeEvmClient({})), staleMinutes: 15 });

  const row = await TransaccionBlockchain.findByPk(w.id);
  expect(row.estado).toBe('procesando');
});
