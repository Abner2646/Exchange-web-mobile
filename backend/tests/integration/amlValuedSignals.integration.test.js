// backend/tests/integration/amlValuedSignals.integration.test.js
// End-to-end integration for the USD-valued AML signals (S1, S2) + the monitoring-off
// gate and unvaluable-asset resilience. Drives the full stack:
//   consumer.handleEvent → evaluator → valuation/dataAccess → cases
require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const { BlockchainTransaction, Crypto, SwapPair, AmlCase, User } = require('../../models');
const businessConfig = require('../../modules/config/businessConfig');
const consumer = require('../../modules/aml/amlConsumer');
const { randomUUID } = require('crypto');

beforeEach(async () => { await resetDb(); businessConfig.clearCache(); });
afterAll(async () => { await sequelize.close(); });

// Seeds a BTC/USDT pair at $10 000. Returns { usdt, btc }.
async function usdtBtc() {
  const usdt = await Crypto.create({ symbol: 'USDT', name: 'Tether', network: 'ethereum', decimals: 6 });
  const btc  = await Crypto.create({ symbol: 'BTC',  name: 'BTC',    network: 'bitcoin',  decimals: 8 });
  await SwapPair.create({
    baseCryptoId:  btc.id,
    quoteCryptoId: usdt.id,
    currentPrice:  '10000',
    feePercent:    '0.1',
    active:        true,
  });
  return { usdt, btc };
}

// Creates a withdrawal BlockchainTransaction. `minutesAgo` is cosmetic here
// (all three are within the 24 h S2 window already), but raw SQL lets us set
// distinct timestamps when strict ordering is needed.
async function wd(userId, cryptoId, amount, minutesAgo) {
  const row = await BlockchainTransaction.create({
    userId,
    cryptoId,
    type:             'withdrawal',
    amount,
    status:           'processing',
    txHash:           `w-${randomUUID()}`,
    confirmations:    0,
    requiresApproval: false,
  });
  // Back-date via raw SQL so Sequelize's timestamp override does not interfere.
  const ts = new Date(Date.now() - minutesAgo * 60000).toISOString();
  await sequelize.query(
    'UPDATE blockchain_transactions SET created_at = :ts WHERE id = :id',
    { replacements: { ts, id: row.id } }
  );
  return row;
}

describe('AML valued signals end-to-end', () => {
  test('S2 structuring: 3 BTC withdrawals ≈ $9 k each (0.9 BTC @ $10 k) opens a high case', async () => {
    await businessConfig.set('aml.monitoring.enabled', 'true');
    const u = await f.seedUser();
    const { btc } = await usdtBtc();

    // Three withdrawals of 0.9 BTC ($9 000 each) – all inside the 24 h window.
    // Each is below the $10 000 threshold but their combined value ($27 000) is
    // well above it → classic structuring pattern (FinCEN FIN-2014-A005).
    await wd(u.id, btc.id, '0.9', 30); // $9 000, 30 min ago
    await wd(u.id, btc.id, '0.9', 20); // $9 000, 20 min ago
    const last = await wd(u.id, btc.id, '0.9', 10); // $9 000, 10 min ago

    // event.id MUST be a real UUID – the source_event_id column is DataTypes.UUID.
    await consumer.handleEvent({
      id:      randomUUID(),
      type:    'WithdrawalTransmitted',
      payload: { blockchainTransactionId: last.id, userId: u.id, cryptoId: btc.id, amount: '0.9' },
    });

    const s2 = await AmlCase.findOne({ where: { signalId: 'S2' } });
    expect(s2).not.toBeNull();
    expect(s2.severity).toBe('high');
    expect((await User.findByPk(u.id)).amlRiskLevel).toBe('high');
  });

  test('monitoring OFF → no valued cases even with structuring pattern', async () => {
    // aml.monitoring.enabled is NOT set → defaults to false → consumer exits early.
    const u = await f.seedUser();
    const { btc } = await usdtBtc();
    const last = await wd(u.id, btc.id, '0.9', 10);

    await consumer.handleEvent({
      id:      randomUUID(),
      type:    'WithdrawalTransmitted',
      payload: { blockchainTransactionId: last.id, userId: u.id, cryptoId: btc.id, amount: '0.9' },
    });

    expect(await AmlCase.count()).toBe(0);
  });

  test('unvaluable asset does not crash the consumer and opens no S2 case', async () => {
    await businessConfig.set('aml.monitoring.enabled', 'true');
    const u = await f.seedUser();
    // DOGE has no stable-quote pair → getUsdValue returns { usd: null } → S2
    // drops it as unvaluable instead of throwing.
    const doge = await Crypto.create({ symbol: 'DOGE', name: 'Dogecoin', network: 'dogecoin', decimals: 8 });
    const last = await wd(u.id, doge.id, '100000', 10);

    // Must not throw.
    await expect(
      consumer.handleEvent({
        id:      randomUUID(),
        type:    'WithdrawalTransmitted',
        payload: { blockchainTransactionId: last.id, userId: u.id, cryptoId: doge.id, amount: '100000' },
      })
    ).resolves.toBeUndefined();

    // No valued S2 case because DOGE cannot be priced in USD.
    expect(await AmlCase.findOne({ where: { signalId: 'S2' } })).toBeNull();
  });
});
