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

const posting = require('../../services/ledger/postingService');

describe('postTransaction', () => {
  async function seedCryptoAndUser() {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    return { cripto, user };
  }

  test('posts a balanced transfer and updates both projections', async () => {
    const { cripto, user } = await seedCryptoAndUser();
    // Fund the user first (apertura -> funding:disponible +10).
    await posting.postTransaction({
      tipo: 'apertura', referencia: 'seed-1', lineas: [
        { ownerId: null, proposito: ledgerAccounts.PROPOSITOS.APERTURA, criptomonedaId: cripto.id, monto: '-10.00000000' },
        { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id, monto: '10.00000000' },
      ],
    });

    // Block 4: disponible -> bloqueado.
    await posting.postTransaction({
      tipo: 'reserva_orden', referencia: 'block-1', lineas: [
        { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id, monto: '-4.00000000' },
        { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: cripto.id, monto: '4.00000000' },
      ],
    });

    const disp = await posting.getSaldoCuenta({ ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id });
    const bloq = await posting.getSaldoCuenta({ ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: cripto.id });
    expect(disp).toBe('6.00000000');
    expect(bloq).toBe('4.00000000');
  });

  test('is idempotent on referencia (a replay posts nothing)', async () => {
    const { cripto, user } = await seedCryptoAndUser();
    const lineas = [
      { ownerId: null, proposito: ledgerAccounts.PROPOSITOS.APERTURA, criptomonedaId: cripto.id, monto: '-3.00000000' },
      { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id, monto: '3.00000000' },
    ];
    await posting.postTransaction({ tipo: 'apertura', referencia: 'dup-1', lineas });
    await posting.postTransaction({ tipo: 'apertura', referencia: 'dup-1', lineas }); // replay

    expect(await AsientoLedger.count()).toBe(1);
    const disp = await posting.getSaldoCuenta({ ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id });
    expect(disp).toBe('3.00000000');
  });

  test('rejects an overdraw on a user account and rolls back the whole asiento', async () => {
    const { cripto, user } = await seedCryptoAndUser();
    await expect(posting.postTransaction({
      tipo: 'reserva_orden', referencia: 'over-1', lineas: [
        { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id, monto: '-5.00000000' },
        { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: cripto.id, monto: '5.00000000' },
      ],
    })).rejects.toThrow(/sobregiro/i);

    expect(await AsientoLedger.count()).toBe(0); // rolled back
    expect(await MovimientoLedger.count()).toBe(0);
  });

  test('rejects an unbalanced asiento before touching the DB', async () => {
    const { cripto, user } = await seedCryptoAndUser();
    await expect(posting.postTransaction({
      tipo: 'apertura', referencia: 'bad-1', lineas: [
        { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id, monto: '5.00000000' },
      ],
    })).rejects.toThrow(/desbalanceado/i);
    expect(await AsientoLedger.count()).toBe(0);
  });
});
