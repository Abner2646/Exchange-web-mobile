require('../helpers/testEnv');
const { sequelize } = require('../../models');
const { resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const posting = require('../../modules/balances/ledger/postingService');
const ledgerAccounts = require('../../modules/balances/ledger/ledgerAccounts');
const recon = require('../../modules/balances/ledger/reconciliation');

beforeEach(resetDb);
afterAll(async () => { await sequelize.close(); });

describe('reconciliation', () => {
  test('internal: projection equals the sum of postings for every account', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await posting.postTransaction({ type: 'apertura', reference: 'rec-1', lines: [
      { ownerId: null, purpose: ledgerAccounts.PURPOSES.APERTURA, cryptoId: cripto.id, amount: '-7.00000000' },
      { ownerId: user.id, purpose: ledgerAccounts.PURPOSES.FUNDING_AVAILABLE, cryptoId: cripto.id, amount: '7.00000000' },
    ] });

    const res = await recon.reconcileInternal();
    expect(res.ok).toBe(true);
    expect(res.discrepancies).toEqual([]);
  });

  test('external: the book closes to zero per crypto (sum of all postings is zero)', async () => {
    const cripto = await f.seedCripto('USDT');
    const user = await f.seedUser();
    await posting.postTransaction({ type: 'apertura', reference: 'rec-2', lines: [
      { ownerId: null, purpose: ledgerAccounts.PURPOSES.APERTURA, cryptoId: cripto.id, amount: '-100.00000000' },
      { ownerId: user.id, purpose: ledgerAccounts.PURPOSES.FUNDING_AVAILABLE, cryptoId: cripto.id, amount: '100.00000000' },
    ] });

    const res = await recon.reconcileExternal();
    expect(res.ok).toBe(true);
    expect(res.byCrypto[cripto.id].net).toBe('0'); // money.add usa toFixed() sin escala fija
  });
});
