require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const FakeEvmClient = require('../helpers/fakeEvmClient');
const BscService = require('../../services/blockchain/bsc.service');
const { TransaccionBlockchain } = require('../../models');

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

// BNB cripto on the test network (actualNetwork = 'bsc-testnet' under NODE_ENV=test).
async function seedBnb() {
  const bnb = await f.seedCripto('BNB');
  await bnb.update({ red: 'bsc-testnet' }); // match actualNetwork; native (no contract)
  return bnb;
}

async function seedPendingWithdrawal(user, bnb, cantidad) {
  return TransaccionBlockchain.createWithdrawal({
    userId: user.id, criptomonedaId: bnb.id, cantidad, direccionDestino: '0xrecipient0000000000000000000000000000dead',
  });
}

describe('BNB native withdrawal — processPendingWithdrawals (fake chain)', () => {
  test('sends the pending withdrawal and marks it procesando with txHash + fee', async () => {
    const user = await f.seedUser();
    const bnb = await seedBnb();
    await f.seedBalance(user, bnb, '5');
    const w = await seedPendingWithdrawal(user, bnb, '1');

    const fake = new FakeEvmClient({ nativeBalance: '10', txHash: '0xbnbsent0000000000000000000000000000000000000000000000000000beef', fee: '0.00042' });
    await new BscService({ chainClient: fake }).processPendingWithdrawals();

    const row = await TransaccionBlockchain.findByPk(w.id);
    expect(row.estado).toBe('procesando');
    expect(row.txHash).toBe('0xbnbsent0000000000000000000000000000000000000000000000000000beef');
    expect(row.feeBlockchain).toBe('0.00042000');
    expect(fake.signCalls).toHaveLength(1);
    expect(fake.signCalls[0].toAddress).toBe('0xrecipient0000000000000000000000000000dead');
    expect(fake.broadcastCalls).toHaveLength(1);
  });

  test('insufficient master wallet balance → not sent, marked fallido, user balance restored', async () => {
    const user = await f.seedUser();
    const bnb = await seedBnb();
    await f.seedBalance(user, bnb, '5');
    const w = await seedPendingWithdrawal(user, bnb, '1');

    const fake = new FakeEvmClient({ nativeBalance: '0.001' });
    await new BscService({ chainClient: fake }).processPendingWithdrawals();

    const row = await TransaccionBlockchain.findByPk(w.id);
    expect(row.estado).toBe('fallido');
    expect(fake.signCalls).toHaveLength(0);
    const bal = await f.getBalance(user, bnb);
    expect(bal.balanceDisponible).toBe('5.00000000');
    expect(bal.balanceBloqueado).toBe('0.00000000');
  });

  test('BEP20 token withdrawal goes through sendTokenTransfer', async () => {
    const user = await f.seedUser();
    const busd = await f.seedCripto('BUSD');
    await busd.update({ red: 'bsc-testnet', direccionContrato: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' });
    await f.seedBalance(user, busd, '500');
    const w = await TransaccionBlockchain.createWithdrawal({
      userId: user.id, criptomonedaId: busd.id, cantidad: '100', direccionDestino: '0xrecipient0000000000000000000000000000dead',
    });

    const fake = new FakeEvmClient({ tokenBalance: '1000', txHash: '0xbeptok0000000000000000000000000000000000000000000000000000beef' });
    await new BscService({ chainClient: fake }).processPendingWithdrawals();

    const row = await TransaccionBlockchain.findByPk(w.id);
    expect(row.estado).toBe('procesando');
    expect(fake.signCalls).toHaveLength(1);
    expect(fake.signCalls[0].kind).toBe('token');
    expect(fake.signCalls[0].contractAddress).toBe('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  });

  test('two concurrent processPendingWithdrawals broadcast at most once', async () => {
    const user = await f.seedUser();
    const bnb = await seedBnb();
    await f.seedBalance(user, bnb, '5');
    await seedPendingWithdrawal(user, bnb, '1');

    const fake = new FakeEvmClient({ nativeBalance: '10' });
    await Promise.all([
      new BscService({ chainClient: fake }).processPendingWithdrawals(),
      new BscService({ chainClient: fake }).processPendingWithdrawals(),
    ]);

    expect(fake.broadcastCalls).toHaveLength(1);
  });
});
