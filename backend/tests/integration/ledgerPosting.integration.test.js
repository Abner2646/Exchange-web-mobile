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
