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

describe('balance mirror — ledger shadows every BalanceUsuario write', () => {
  test('create + updateBalance (static) mirror into funding:disponible', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await BalanceUsuario.create({ userId: user.id, criptomonedaId: cripto.id, balanceDisponible: '5.00000000', balanceBloqueado: '0' });
    await BalanceUsuario.updateBalance(user.id, cripto.id, '3.00000000', 'disponible');

    const l = await fundingLedger(user, cripto);
    const row = await BalanceUsuario.findOne({ where: { userId: user.id, criptomonedaId: cripto.id } });
    expect(l.disponible).toBe(String(row.balanceDisponible)); // 8.00000000
    expect(l.disponible).toBe('8.00000000');
  });

  test('blockBalance (static, two-sided) mirrors disponible->bloqueado', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await BalanceUsuario.create({ userId: user.id, criptomonedaId: cripto.id, balanceDisponible: '10.00000000', balanceBloqueado: '0' });
    await BalanceUsuario.blockBalance(user.id, cripto.id, '4.00000000');

    const l = await fundingLedger(user, cripto);
    const row = await BalanceUsuario.findOne({ where: { userId: user.id, criptomonedaId: cripto.id } });
    expect(l.disponible).toBe(String(row.balanceDisponible)); // 6
    expect(l.bloqueado).toBe(String(row.balanceBloqueado));   // 4
  });

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
