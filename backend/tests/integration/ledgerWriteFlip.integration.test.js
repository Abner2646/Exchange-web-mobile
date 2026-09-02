require('../helpers/testEnv');
const { sequelize, BalanceUsuario, TransaccionBlockchain } = require('../../models');
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
    pendiente: await posting.getSaldoCuenta({ ownerId: user.id, proposito: PROPOSITOS.FUNDING_PENDIENTE, criptomonedaId: cripto.id }),
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

describe('write-flip: deposit settlement posts to the ledger (detected → pending → confirmed)', () => {
  test('detected credits funding:pendiente; _acreditarDeposito moves pending → disponible', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    const { registrarDepositoPendiente } = require('../../services/ledger/operations');

    // Detección on-chain: acredita PENDIENTE (external_onchain → funding:pendiente).
    await registrarDepositoPendiente({ userId: user.id, criptomonedaId: cripto.id, cantidad: '1.50000000', referencia: 'dep-pend:1' });
    let l = await funding(user, cripto);
    expect(l.pendiente).toBe('1.50000000');
    expect(l.disponible).toBe('0');

    // Confirmación: pendiente → disponible.
    await TransaccionBlockchain._acreditarDeposito(
      { id: '11111111-1111-4111-8111-111111111111', userId: user.id, criptomonedaId: cripto.id, cantidad: '1.50000000', estado: 'confirmado' },
      null
    );
    l = await funding(user, cripto);
    expect(l.disponible).toBe('1.50000000');
    expect(l.pendiente).toBe('0.00000000');
    expect((await recon.reconciliarInterno()).ok).toBe(true);
    expect((await recon.reconciliarExterno()).ok).toBe(true);
  });
});

describe('write-flip: updateBalance/blockBalance/unblockBalance post to the ledger, not balances_users', () => {
  test('updateBalance credits the ledger', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '5');

    await BalanceUsuario.updateBalance(user.id, cripto.id, '3.00000000', 'disponible');

    const l = await funding(user, cripto);
    expect(l.disponible).toBe('8.00000000');
  });

  test('updateBalance rejects an overdraw with an /insuficiente/ message', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '1');
    await expect(
      BalanceUsuario.updateBalance(user.id, cripto.id, '-2.00000000', 'disponible')
    ).rejects.toThrow(/insuficiente/i);
  });

  test('blockBalance moves disponible->bloqueado in the ledger', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '10');
    await BalanceUsuario.blockBalance(user.id, cripto.id, '4.00000000');

    const l = await funding(user, cripto);
    expect(l.disponible).toBe('6.00000000');
    expect(l.bloqueado).toBe('4.00000000');
  });

  test('blockBalance rejects blocking more than disponible', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '3');
    await expect(BalanceUsuario.blockBalance(user.id, cripto.id, '5')).rejects.toThrow(/insuficiente/i);
  });

  test('unblockBalance moves bloqueado->disponible in the ledger', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '10');
    await BalanceUsuario.blockBalance(user.id, cripto.id, '6.00000000');
    await BalanceUsuario.unblockBalance(user.id, cripto.id, '2.00000000');

    const l = await funding(user, cripto);
    expect(l.disponible).toBe('6.00000000');
    expect(l.bloqueado).toBe('4.00000000');
  });

  test('reconciliation holds after a mix of method writes', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '10');
    await BalanceUsuario.updateBalance(user.id, cripto.id, '5', 'disponible');
    await BalanceUsuario.blockBalance(user.id, cripto.id, '4');
    await BalanceUsuario.unblockBalance(user.id, cripto.id, '1');

    expect((await recon.reconciliarInterno()).ok).toBe(true);
    expect((await recon.reconciliarExterno()).ok).toBe(true);
  });
});
