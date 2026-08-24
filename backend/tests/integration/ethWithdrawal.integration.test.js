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

    expect(fake.signCalls).toHaveLength(1);
    expect(fake.signCalls[0].toAddress).toBe('0xrecipient0000000000000000000000000000dead');
    expect(fake.signCalls[0].amount).toBe('1.00000000'); // cantidad from DECIMAL(28,8)
    expect(fake.broadcastCalls).toHaveLength(1); // broadcast happened after pre-record
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
    expect(fake.signCalls).toHaveLength(0); // balance check throws before signing

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

    expect(fake.broadcastCalls).toHaveLength(1);
  });
});

describe('ERC20 token withdrawal — via the chain-client port', () => {
  async function seedUsdt() {
    const usdt = await f.seedCripto('USDT');
    await usdt.update({ red: 'sepolia', direccionContrato: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' });
    return usdt;
  }

  test('sends a token withdrawal through sendTokenTransfer and marks it procesando', async () => {
    const user = await f.seedUser();
    const usdt = await seedUsdt();
    await f.seedBalance(user, usdt, '500');
    const w = await seedPendingWithdrawal(user, usdt, '100');

    const fake = new FakeEvmClient({ tokenBalance: '1000', txHash: '0xtoken0000000000000000000000000000000000000000000000000000000beef', fee: '0.0006' });
    await new EthereumService({ chainClient: fake }).processPendingWithdrawals();

    const row = await TransaccionBlockchain.findByPk(w.id);
    expect(row.estado).toBe('procesando');
    expect(row.txHash).toBe('0xtoken0000000000000000000000000000000000000000000000000000000beef');
    expect(fake.signCalls).toHaveLength(1);
    expect(fake.signCalls[0].kind).toBe('token');
    expect(fake.signCalls[0].contractAddress).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(fake.signCalls[0].toAddress).toBe('0xrecipient0000000000000000000000000000dead');
    expect(fake.broadcastCalls).toHaveLength(1);
  });
});

describe('atomic claim before broadcast (anti double-spend)', () => {
  test('claimForProcessing is atomic: two concurrent claims, exactly one wins', async () => {
    const user = await f.seedUser();
    const eth = await seedEth();
    await f.seedBalance(user, eth, '5');
    const w = await seedPendingWithdrawal(user, eth, '1');

    const results = await Promise.all([
      TransaccionBlockchain.claimForProcessing(w.id),
      TransaccionBlockchain.claimForProcessing(w.id),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1); // exactly one true
    const row = await TransaccionBlockchain.findByPk(w.id);
    expect(row.estado).toBe('procesando');
  });

  test('two concurrent processPendingWithdrawals broadcast at most once', async () => {
    const user = await f.seedUser();
    const eth = await seedEth();
    await f.seedBalance(user, eth, '5');
    await seedPendingWithdrawal(user, eth, '1');

    // Shared fake so both instances record into the same sendCalls.
    const fake = new FakeEvmClient({ nativeBalance: '10' });

    await Promise.all([
      new EthereumService({ chainClient: fake }).processPendingWithdrawals(),
      new EthereumService({ chainClient: fake }).processPendingWithdrawals(),
    ]);

    // The atomic claim serializes: only the winner broadcasts.
    expect(fake.broadcastCalls).toHaveLength(1);
  });
});
