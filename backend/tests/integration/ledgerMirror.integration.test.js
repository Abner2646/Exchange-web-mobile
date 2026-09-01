require('../helpers/testEnv');
const { sequelize, BalanceUsuario } = require('../../models');
const { resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const posting = require('../../services/ledger/postingService');
const { PROPOSITOS } = require('../../services/ledger/ledgerAccounts');

beforeEach(resetDb);
afterAll(async () => { await sequelize.close(); });

async function fundingLedger(user, cripto) {
  return {
    disponible: await posting.getSaldoCuenta({ ownerId: user.id, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id }),
    bloqueado: await posting.getSaldoCuenta({ ownerId: user.id, proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: cripto.id }),
  };
}

describe('balance mirror — ledger shadows every raw BalanceUsuario write', () => {
  // NOTA (write-flip Paso B): las estaticas updateBalance/blockBalance/unblock
  // ya NO escriben balances_users (postean al ledger directo), asi que sus tests
  // de paridad-con-el-mirror se removieron. El mirror sigue vivo para las
  // escrituras CRUDAS (create/.update de deposito/retiro) hasta que el write-flip
  // las convierta; eso es lo que este archivo cubre ahora.
  test('raw BalanceUsuario.update (the deposit/withdrawal path) is also mirrored', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    const b = await BalanceUsuario.create({ userId: user.id, criptomonedaId: cripto.id, balanceDisponible: '2.00000000', balanceBloqueado: '0' });
    // Mimic transaccionBlockchain deposit credit: raw bulk update by id.
    await BalanceUsuario.update({ balanceDisponible: '9.00000000' }, { where: { id: b.id } });

    const l = await fundingLedger(user, cripto);
    const row = await BalanceUsuario.findByPk(b.id);
    expect(l.disponible).toBe(String(row.balanceDisponible)); // 9
    expect(l.disponible).toBe('9.00000000');
  });
});

const recon = require('../../services/ledger/reconciliation');

describe('reconciliarConLegacy', () => {
  test('reports parity after mirrored (raw) writes', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    const b = await BalanceUsuario.create({ userId: user.id, criptomonedaId: cripto.id, balanceDisponible: '10.00000000', balanceBloqueado: '0' });
    await BalanceUsuario.update({ balanceDisponible: '12.00000000' }, { where: { id: b.id } });

    const res = await recon.reconciliarConLegacy();
    expect(res.ok).toBe(true);
    expect(res.discrepancias).toEqual([]);
  });
});
