require('../helpers/testEnv');
const { sequelize, UserBalance, TransaccionBlockchain } = require('../../models');
const { resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const posting = require('../../modules/balances/ledger/postingService');
const { PURPOSES } = require('../../modules/balances/ledger/ledgerAccounts');
const recon = require('../../modules/balances/ledger/reconciliation');

beforeEach(resetDb);
afterAll(async () => { await sequelize.close(); });

async function funding(user, cripto) {
  return {
    available: await posting.getAccountBalance({ ownerId: user.id, purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: cripto.id }),
    blocked: await posting.getAccountBalance({ ownerId: user.id, purpose: PURPOSES.FUNDING_BLOCKED, cryptoId: cripto.id }),
    pending: await posting.getAccountBalance({ ownerId: user.id, purpose: PURPOSES.FUNDING_PENDING, cryptoId: cripto.id }),
  };
}

describe('seedBalance seeds the ledger directly (mirror-independent)', () => {
  test('seeds funding:disponible without relying on the mirror hook, and reconciles', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '7');

    const l = await funding(user, cripto);
    expect(l.available).toBe('7.00000000');
    // Not doubled: exactly 7 (would be 14 if both a mirrored create AND apertura fired).
    expect((await recon.reconcileInternal()).ok).toBe(true);
    expect((await recon.reconcileExternal()).ok).toBe(true);
  });
});

describe('write-flip: deposit settlement posts to the ledger (detected → pending → confirmed)', () => {
  test('detected credits funding:pendiente; _acreditarDeposito moves pending → disponible', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    const { registerPendingDeposit } = require('../../modules/balances/ledger/operations');

    // Detección on-chain: acredita PENDIENTE (external_onchain → funding:pendiente).
    await registerPendingDeposit({ userId: user.id, criptomonedaId: cripto.id, cantidad: '1.50000000', referencia: 'dep-pend:1' });
    let l = await funding(user, cripto);
    expect(l.pending).toBe('1.50000000');
    expect(l.available).toBe('0');

    // Confirmación: pendiente → disponible.
    await TransaccionBlockchain._acreditarDeposito(
      { id: '11111111-1111-4111-8111-111111111111', userId: user.id, criptomonedaId: cripto.id, cantidad: '1.50000000', estado: 'confirmado' },
      null
    );
    l = await funding(user, cripto);
    expect(l.available).toBe('1.50000000');
    expect(l.pending).toBe('0.00000000');
    expect((await recon.reconcileInternal()).ok).toBe(true);
    expect((await recon.reconcileExternal()).ok).toBe(true);
  });
});

describe('write-flip: updateBalance/blockBalance/unblockBalance post to the ledger, not balances_users', () => {
  test('updateBalance credits the ledger', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '5');

    await UserBalance.updateBalance(user.id, cripto.id, '3.00000000', 'available');

    const l = await funding(user, cripto);
    expect(l.available).toBe('8.00000000');
  });

  test('updateBalance rejects an overdraw with an /insuficiente/ message', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '1');
    await expect(
      UserBalance.updateBalance(user.id, cripto.id, '-2.00000000', 'available')
    ).rejects.toThrow(/insuficiente/i);
  });

  test('blockBalance moves disponible->bloqueado in the ledger', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '10');
    await UserBalance.blockBalance(user.id, cripto.id, '4.00000000');

    const l = await funding(user, cripto);
    expect(l.available).toBe('6.00000000');
    expect(l.blocked).toBe('4.00000000');
  });

  test('blockBalance rejects blocking more than disponible', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '3');
    await expect(UserBalance.blockBalance(user.id, cripto.id, '5')).rejects.toThrow(/insuficiente/i);
  });

  test('unblockBalance moves bloqueado->disponible in the ledger', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '10');
    await UserBalance.blockBalance(user.id, cripto.id, '6.00000000');
    await UserBalance.unblockBalance(user.id, cripto.id, '2.00000000');

    const l = await funding(user, cripto);
    expect(l.available).toBe('6.00000000');
    expect(l.blocked).toBe('4.00000000');
  });

  test('reconciliation holds after a mix of method writes', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '10');
    await UserBalance.updateBalance(user.id, cripto.id, '5', 'available');
    await UserBalance.blockBalance(user.id, cripto.id, '4');
    await UserBalance.unblockBalance(user.id, cripto.id, '1');

    expect((await recon.reconcileInternal()).ok).toBe(true);
    expect((await recon.reconcileExternal()).ok).toBe(true);
  });
});
