require('../helpers/testEnv');
const { sequelize } = require('../../models');
const { resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const posting = require('../../services/ledger/postingService');
const ledgerAccounts = require('../../services/ledger/ledgerAccounts');
const recon = require('../../services/ledger/reconciliation');

beforeEach(resetDb);
afterAll(async () => { await sequelize.close(); });

describe('reconciliation', () => {
  test('internal: projection equals the sum of postings for every account', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await posting.postTransaction({ tipo: 'apertura', referencia: 'rec-1', lineas: [
      { ownerId: null, proposito: ledgerAccounts.PROPOSITOS.APERTURA, criptomonedaId: cripto.id, monto: '-7.00000000' },
      { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id, monto: '7.00000000' },
    ] });

    const res = await recon.reconciliarInterno();
    expect(res.ok).toBe(true);
    expect(res.discrepancias).toEqual([]);
  });

  test('external: the book closes to zero per crypto (sum of all postings is zero)', async () => {
    const cripto = await f.seedCripto('USDT');
    const user = await f.seedUser();
    await posting.postTransaction({ tipo: 'apertura', referencia: 'rec-2', lineas: [
      { ownerId: null, proposito: ledgerAccounts.PROPOSITOS.APERTURA, criptomonedaId: cripto.id, monto: '-100.00000000' },
      { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id, monto: '100.00000000' },
    ] });

    const res = await recon.reconciliarExterno();
    expect(res.ok).toBe(true);
    expect(res.porCripto[cripto.id].neto).toBe('0'); // money.add usa toFixed() sin escala fija
  });
});
