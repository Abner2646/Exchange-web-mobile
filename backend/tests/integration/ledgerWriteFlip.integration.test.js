require('../helpers/testEnv');
const { sequelize, BalanceUsuario } = require('../../models');
const { resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const posting = require('../../services/ledger/postingService');
const { PROPOSITOS } = require('../../services/ledger/ledgerAccounts');
const recon = require('../../services/ledger/reconciliation');

beforeEach(resetDb);
afterAll(async () => { await sequelize.close(); });

async function funding(user, cripto) {
  return {
    disponible: await posting.getSaldoCuenta({ ownerId: user.id, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id }),
    bloqueado: await posting.getSaldoCuenta({ ownerId: user.id, proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: cripto.id }),
  };
}

describe('seedBalance seeds the ledger directly (mirror-independent)', () => {
  test('seeds funding:disponible without relying on the mirror hook, and reconciles', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '7');

    const l = await funding(user, cripto);
    expect(l.disponible).toBe('7.00000000');
    // Not doubled: exactly 7 (would be 14 if both a mirrored create AND apertura fired).
    expect((await recon.reconciliarInterno()).ok).toBe(true);
    expect((await recon.reconciliarExterno()).ok).toBe(true);
  });
});
