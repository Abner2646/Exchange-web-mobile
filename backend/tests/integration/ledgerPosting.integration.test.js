require('../helpers/testEnv');
const { sequelize, LedgerAccount, LedgerEntry, LedgerMovement, LedgerBalance } = require('../../models');
const { resetDb } = require('../helpers/db');

beforeEach(resetDb);
afterAll(async () => { await sequelize.close(); });

describe('ledger schema', () => {
  test('the four ledger models are registered and their tables exist', async () => {
    expect(LedgerAccount).toBeDefined();
    expect(LedgerEntry).toBeDefined();
    expect(LedgerMovement).toBeDefined();
    expect(LedgerBalance).toBeDefined();
    // Tables created by sync: a count query must not throw.
    await expect(LedgerAccount.count()).resolves.toBe(0);
    await expect(LedgerEntry.count()).resolves.toBe(0);
    await expect(LedgerMovement.count()).resolves.toBe(0);
    await expect(LedgerBalance.count()).resolves.toBe(0);
  });
});

const ledgerAccounts = require('../../modules/balances/ledger/ledgerAccounts');
const f = require('../helpers/factories');

describe('ledgerAccounts.resolveAccount', () => {
  test('get-or-creates an account and is idempotent on the natural key', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();

    const first = await ledgerAccounts.resolveAccount(
      { ownerId: user.id, purpose: ledgerAccounts.PURPOSES.FUNDING_AVAILABLE, cryptoId: cripto.id }
    );
    const again = await ledgerAccounts.resolveAccount(
      { ownerId: user.id, purpose: ledgerAccounts.PURPOSES.FUNDING_AVAILABLE, cryptoId: cripto.id }
    );

    expect(first.id).toBe(again.id);
    expect(await LedgerAccount.count()).toBe(1);
    expect(ledgerAccounts.isUserAccount(first)).toBe(true);
  });

  test('a house account resolves under the sentinel owner', async () => {
    const cripto = await f.seedCripto('USDT');
    const casa = await ledgerAccounts.resolveAccount(
      { ownerId: null, purpose: ledgerAccounts.PURPOSES.FEE_REVENUE, cryptoId: cripto.id }
    );
    expect(casa.ownerId).toBe(ledgerAccounts.HOUSE_OWNER_ID);
    expect(ledgerAccounts.isUserAccount(casa)).toBe(false);
  });
});

const posting = require('../../modules/balances/ledger/postingService');

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
      type: 'apertura', reference: 'seed-1', lines: [
        { ownerId: null, purpose: ledgerAccounts.PURPOSES.APERTURA, cryptoId: cripto.id, amount: '-10.00000000' },
        { ownerId: user.id, purpose: ledgerAccounts.PURPOSES.FUNDING_AVAILABLE, cryptoId: cripto.id, amount: '10.00000000' },
      ],
    });

    // Block 4: disponible -> bloqueado.
    await posting.postTransaction({
      type: 'reserva_orden', reference: 'block-1', lines: [
        { ownerId: user.id, purpose: ledgerAccounts.PURPOSES.FUNDING_AVAILABLE, cryptoId: cripto.id, amount: '-4.00000000' },
        { ownerId: user.id, purpose: ledgerAccounts.PURPOSES.FUNDING_BLOCKED, cryptoId: cripto.id, amount: '4.00000000' },
      ],
    });

    const disp = await posting.getAccountBalance({ ownerId: user.id, purpose: ledgerAccounts.PURPOSES.FUNDING_AVAILABLE, cryptoId: cripto.id });
    const bloq = await posting.getAccountBalance({ ownerId: user.id, purpose: ledgerAccounts.PURPOSES.FUNDING_BLOCKED, cryptoId: cripto.id });
    expect(disp).toBe('6.00000000');
    expect(bloq).toBe('4.00000000');
  });

  test('is idempotent on referencia (a replay posts nothing)', async () => {
    const { cripto, user } = await seedCryptoAndUser();
    const lines = [
      { ownerId: null, purpose: ledgerAccounts.PURPOSES.APERTURA, cryptoId: cripto.id, amount: '-3.00000000' },
      { ownerId: user.id, purpose: ledgerAccounts.PURPOSES.FUNDING_AVAILABLE, cryptoId: cripto.id, amount: '3.00000000' },
    ];
    await posting.postTransaction({ type: 'apertura', reference: 'dup-1', lines });
    await posting.postTransaction({ type: 'apertura', reference: 'dup-1', lines }); // replay

    expect(await LedgerEntry.count()).toBe(1);
    const disp = await posting.getAccountBalance({ ownerId: user.id, purpose: ledgerAccounts.PURPOSES.FUNDING_AVAILABLE, cryptoId: cripto.id });
    expect(disp).toBe('3.00000000');
  });

  test('rejects an overdraw on a user account and rolls back the whole asiento', async () => {
    const { cripto, user } = await seedCryptoAndUser();
    await expect(posting.postTransaction({
      type: 'reserva_orden', reference: 'over-1', lines: [
        { ownerId: user.id, purpose: ledgerAccounts.PURPOSES.FUNDING_AVAILABLE, cryptoId: cripto.id, amount: '-5.00000000' },
        { ownerId: user.id, purpose: ledgerAccounts.PURPOSES.FUNDING_BLOCKED, cryptoId: cripto.id, amount: '5.00000000' },
      ],
    })).rejects.toThrow(/overdraft/i);

    expect(await LedgerEntry.count()).toBe(0); // rolled back
    expect(await LedgerMovement.count()).toBe(0);
  });

  test('rejects an unbalanced asiento before touching the DB', async () => {
    const { cripto, user } = await seedCryptoAndUser();
    await expect(posting.postTransaction({
      type: 'apertura', reference: 'bad-1', lines: [
        { ownerId: user.id, purpose: ledgerAccounts.PURPOSES.FUNDING_AVAILABLE, cryptoId: cripto.id, amount: '5.00000000' },
      ],
    })).rejects.toThrow(/unbalanced/i);
    expect(await LedgerEntry.count()).toBe(0);
  });
});

describe('postTransaction concurrency (Criticos #5 regression)', () => {
  test('two concurrent blocks of the same funds: exactly one succeeds, no overdraw', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    // Fund with exactly 5.
    await posting.postTransaction({ type: 'apertura', reference: 'conc-seed', lines: [
      { ownerId: null, purpose: ledgerAccounts.PURPOSES.APERTURA, cryptoId: cripto.id, amount: '-5.00000000' },
      { ownerId: user.id, purpose: ledgerAccounts.PURPOSES.FUNDING_AVAILABLE, cryptoId: cripto.id, amount: '5.00000000' },
    ] });

    const bloquear = (ref) => posting.postTransaction({ type: 'reserva_orden', reference: ref, lines: [
      { ownerId: user.id, purpose: ledgerAccounts.PURPOSES.FUNDING_AVAILABLE, cryptoId: cripto.id, amount: '-5.00000000' },
      { ownerId: user.id, purpose: ledgerAccounts.PURPOSES.FUNDING_BLOCKED, cryptoId: cripto.id, amount: '5.00000000' },
    ] });

    const results = await Promise.allSettled([bloquear('conc-a'), bloquear('conc-b')]);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    expect(ok).toBe(1);
    expect(failed).toBe(1);

    const disp = await posting.getAccountBalance({ ownerId: user.id, purpose: ledgerAccounts.PURPOSES.FUNDING_AVAILABLE, cryptoId: cripto.id });
    const bloq = await posting.getAccountBalance({ ownerId: user.id, purpose: ledgerAccounts.PURPOSES.FUNDING_BLOCKED, cryptoId: cripto.id });
    expect(disp).toBe('0.00000000');
    expect(bloq).toBe('5.00000000');
  });
});
