require('../helpers/testEnv');
const { sequelize, BalanceUsuario } = require('../../models');
const { resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const posting = require('../../services/ledger/postingService');
const ledgerAccounts = require('../../services/ledger/ledgerAccounts');
const recon = require('../../services/ledger/reconciliation');
const { backfillSaldosDeApertura } = require('../../services/ledger/backfill');

beforeEach(resetDb);
afterAll(async () => { await sequelize.close(); });

describe('backfillSaldosDeApertura', () => {
  test('mirrors each BalanceUsuario into funding disponible/bloqueado and reconciles', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await BalanceUsuario.create({
      userId: user.id, criptomonedaId: cripto.id,
      balanceDisponible: '6.00000000', balanceBloqueado: '4.00000000',
    });

    const res = await backfillSaldosDeApertura();
    expect(res.asientos).toBe(1);

    const disp = await posting.getSaldoCuenta({ ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id });
    const bloq = await posting.getSaldoCuenta({ ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: cripto.id });
    expect(disp).toBe('6.00000000');
    expect(bloq).toBe('4.00000000');

    expect((await recon.reconciliarInterno()).ok).toBe(true);
    expect((await recon.reconciliarExterno()).ok).toBe(true);
  });

  test('is idempotent: running twice does not double the opening balances', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await BalanceUsuario.create({
      userId: user.id, criptomonedaId: cripto.id,
      balanceDisponible: '3.00000000', balanceBloqueado: '0',
    });

    await backfillSaldosDeApertura();
    await backfillSaldosDeApertura();

    const disp = await posting.getSaldoCuenta({ ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id });
    expect(disp).toBe('3.00000000');
  });

  test('skips zero balances (posts no asiento)', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await BalanceUsuario.create({
      userId: user.id, criptomonedaId: cripto.id,
      balanceDisponible: '0', balanceBloqueado: '0',
    });

    const res = await backfillSaldosDeApertura();
    expect(res.asientos).toBe(0);
  });
});
