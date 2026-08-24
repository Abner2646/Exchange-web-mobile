require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const FakeEvmClient = require('../helpers/fakeEvmClient');
const EthereumService = require('../../services/blockchain/ethereum.service');
const { TransaccionBlockchain } = require('../../models');

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

// ETH cripto on the test network (actualNetwork = 'sepolia' under NODE_ENV=test).
async function seedEth() {
  const eth = await f.seedCripto('ETH');       // symbol ETH
  await eth.update({ red: 'sepolia' });         // match actualNetwork; native (no contract)
  return eth;
}

async function seedPendingWithdrawal(user, eth, cantidad) {
  return TransaccionBlockchain.createWithdrawal({
    userId: user.id, criptomonedaId: eth.id, cantidad, direccionDestino: '0xrecipient0000000000000000000000000000dead',
  });
}

describe('ETH native withdrawal — processPendingWithdrawals (fake chain)', () => {
  test('sends the pending withdrawal and marks it procesando with txHash + fee', async () => {
    const user = await f.seedUser();
    const eth = await seedEth();
    await f.seedBalance(user, eth, '5');
    const w = await seedPendingWithdrawal(user, eth, '1');

    const fake = new FakeEvmClient({ nativeBalance: '10', txHash: '0xsent00000000000000000000000000000000000000000000000000000000beef', fee: '0.00042' });
    const service = new EthereumService({ chainClient: fake });

    await service.processPendingWithdrawals();

    const row = await TransaccionBlockchain.findByPk(w.id);
    expect(row.estado).toBe('procesando');
    expect(row.txHash).toBe('0xsent00000000000000000000000000000000000000000000000000000000beef');
    expect(row.feeBlockchain).toBe('0.00042000');

    expect(fake.sendCalls).toHaveLength(1);
    expect(fake.sendCalls[0].toAddress).toBe('0xrecipient0000000000000000000000000000dead');
    expect(fake.sendCalls[0].amount).toBe('1.00000000'); // cantidad from DECIMAL(28,8)
  });

  test('insufficient master wallet balance → not sent, marked fallido, user balance restored', async () => {
    const user = await f.seedUser();
    const eth = await seedEth();
    await f.seedBalance(user, eth, '5');
    const w = await seedPendingWithdrawal(user, eth, '1'); // locks 1 → available 4, blocked 1

    const fake = new FakeEvmClient({ nativeBalance: '0.001' }); // < 1
    await new EthereumService({ chainClient: fake }).processPendingWithdrawals();

    const row = await TransaccionBlockchain.findByPk(w.id);
    expect(row.estado).toBe('fallido');
    expect(fake.sendCalls).toHaveLength(0);

    // failWithdrawal returns the locked funds to available.
    const bal = await f.getBalance(user, eth);
    expect(bal.balanceDisponible).toBe('5.00000000');
    expect(bal.balanceBloqueado).toBe('0.00000000');
  });

  test('a second run does not re-send an already-processing withdrawal', async () => {
    const user = await f.seedUser();
    const eth = await seedEth();
    await f.seedBalance(user, eth, '5');
    await seedPendingWithdrawal(user, eth, '1');

    const fake = new FakeEvmClient({ nativeBalance: '10' });
    const service = new EthereumService({ chainClient: fake });

    await service.processPendingWithdrawals(); // sends, row → procesando
    await service.processPendingWithdrawals(); // query only picks 'pendiente' → nothing

    expect(fake.sendCalls).toHaveLength(1);
  });
});
