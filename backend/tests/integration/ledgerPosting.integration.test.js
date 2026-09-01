require('../helpers/testEnv');
const { sequelize, CuentaLedger, AsientoLedger, MovimientoLedger, SaldoLedger } = require('../../models');
const { resetDb } = require('../helpers/db');

beforeEach(resetDb);
afterAll(async () => { await sequelize.close(); });

describe('ledger schema', () => {
  test('the four ledger models are registered and their tables exist', async () => {
    expect(CuentaLedger).toBeDefined();
    expect(AsientoLedger).toBeDefined();
    expect(MovimientoLedger).toBeDefined();
    expect(SaldoLedger).toBeDefined();
    // Tables created by sync: a count query must not throw.
    await expect(CuentaLedger.count()).resolves.toBe(0);
    await expect(AsientoLedger.count()).resolves.toBe(0);
    await expect(MovimientoLedger.count()).resolves.toBe(0);
    await expect(SaldoLedger.count()).resolves.toBe(0);
  });
});

const ledgerAccounts = require('../../services/ledger/ledgerAccounts');
const f = require('../helpers/factories');

describe('ledgerAccounts.resolveAccount', () => {
  test('get-or-creates an account and is idempotent on the natural key', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();

    const first = await ledgerAccounts.resolveAccount(
      { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id }
    );
    const again = await ledgerAccounts.resolveAccount(
      { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id }
    );

    expect(first.id).toBe(again.id);
    expect(await CuentaLedger.count()).toBe(1);
    expect(ledgerAccounts.isCuentaUsuario(first)).toBe(true);
  });

  test('a house account resolves under the sentinel owner', async () => {
    const cripto = await f.seedCripto('USDT');
    const casa = await ledgerAccounts.resolveAccount(
      { ownerId: null, proposito: ledgerAccounts.PROPOSITOS.FEE_REVENUE, criptomonedaId: cripto.id }
    );
    expect(casa.ownerId).toBe(ledgerAccounts.HOUSE_OWNER_ID);
    expect(ledgerAccounts.isCuentaUsuario(casa)).toBe(false);
  });
});
