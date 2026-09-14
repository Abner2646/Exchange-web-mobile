// tests/integration/blockchainEvents.integration.test.js
// Fase 6.2.1 slice 3 — DepositRegistered / DepositConfirmed / WithdrawalTransmitted
// Verifies that each custody-boundary op writes an outbox row in the same DB
// transaction, and that the end-to-end publisher→audit chain works for
// DepositRegistered.
require('../helpers/testEnv');
const { sequelize, OutboxEvent, AuditLog, BlockchainTransaction } = require('../../models');
const { registerAllHandlers } = require('../../modules/events/registerHandlers');
const publisherJob = require('../../jobs/outboxPublisher.job');
const f = require('../helpers/factories');

let user, btc;
beforeAll(async () => {
  await sequelize.sync({ force: true });
  registerAllHandlers();
  user = await f.seedUser();
  btc = await f.seedCripto('BTC');
});
afterAll(async () => { await sequelize.close(); });

describe('blockchain money events', () => {
  test('createDeposit emits DepositRegistered; publisher audits it end-to-end', async () => {
    await BlockchainTransaction.createDeposit({
      userId: user.id,
      cryptoId: btc.id,
      amount: '0.5',
      txHash: '0xdep1',
    });

    const rows = await OutboxEvent.findAll({ where: { type: 'DepositRegistered' } });
    expect(rows).toHaveLength(1);

    const evt = rows[0];
    expect(evt.payload.userId).toBe(user.id);
    expect(evt.payload.cryptoId).toBe(btc.id);
    // amount is serialized from the DB DECIMAL(28,8) value via String()
    expect(evt.payload.amount).toMatch(/^0\.5/);
    expect(evt.payload.txHash).toBe('0xdep1');
    // aggregateId must equal the blockchain tx id stored in the payload
    expect(evt.aggregateId).toBe(evt.payload.blockchainTransactionId);

    // End-to-end: publisher dispatches → audit consumer chains a row
    await publisherJob.run();
    const audit = await AuditLog.findAll({ where: { eventId: evt.id } });
    expect(audit).toHaveLength(1);
    expect(audit[0].eventType).toBe('DepositRegistered');
  });

  test('updateConfirmations on a deposit emits DepositConfirmed in the same tx', async () => {
    // Create a pending deposit first (re-use a different hash to avoid unique conflict)
    const dep = await BlockchainTransaction.createDeposit({
      userId: user.id,
      cryptoId: btc.id,
      amount: '0.25',
      txHash: '0xdep2',
    });

    // Drive it to confirmed (requiredConfirmations defaults to 6)
    await BlockchainTransaction.updateConfirmations(dep.id, 6);

    const rows = await OutboxEvent.findAll({ where: { type: 'DepositConfirmed' } });
    expect(rows).toHaveLength(1);

    const evt = rows[0];
    expect(evt.payload.blockchainTransactionId).toBe(dep.id);
    expect(evt.aggregateId).toBe(dep.id);
    expect(evt.payload.userId).toBe(user.id);
    expect(evt.payload.amount).toMatch(/^0\.25/);
  });

  test('updateConfirmations on a withdrawal emits WithdrawalTransmitted in the same tx', async () => {
    // Seed available balance so createWithdrawal can block it
    await f.seedBalance(user, btc, '1');

    const wit = await BlockchainTransaction.createWithdrawal({
      userId: user.id,
      cryptoId: btc.id,
      amount: '0.1',
      destinationAddress: 'addr_test_1',
    });

    // Mark it as sent (processing + txHash) so updateConfirmations can confirm it
    await BlockchainTransaction.markWithdrawalAsSent(wit.id, '0xwith1', 0);

    // Confirm on-chain
    await BlockchainTransaction.updateConfirmations(wit.id, 6);

    const rows = await OutboxEvent.findAll({ where: { type: 'WithdrawalTransmitted' } });
    expect(rows).toHaveLength(1);

    const evt = rows[0];
    expect(evt.payload.blockchainTransactionId).toBe(wit.id);
    expect(evt.aggregateId).toBe(wit.id);
    expect(evt.payload.userId).toBe(user.id);
    expect(evt.payload.amount).toMatch(/^0\.1/);
    expect(evt.payload.destinationAddress).toBe('addr_test_1');
    expect(evt.payload.txHash).toBe('0xwith1');
  });
});
