// tests/transaccionBlockchain.model.test.js
//
// Write-flip (Paso B) + Paso D. El settlement delega en operaciones de dominio
// del ledger: acreditar depósito → confirmDeposit (pendiente→disponible);
// fallar retiro → unblockBalance. Este unit test verifica esa DELEGACION; el
// resultado en el ledger se cubre en ledgerWriteFlip.integration.test.js.

jest.mock('../modules/wallets/blockchainTransaction.entity');
jest.mock('../models/index', () => ({ UserBalance: {} }));
jest.mock('../modules/balances/ledger/operations', () => ({
  confirmDeposit: jest.fn(),
  registerPendingDeposit: jest.fn(),
  markWithdrawalTransmitted: jest.fn(),
}));
jest.mock('../modules/events/emitEvent', () => ({ emitEvent: jest.fn().mockResolvedValue({ id: 'evt' }) }));

const initTransaccionBlockchain = require('../modules/wallets/blockchainTransaction.entity');
const { UserBalance } = require('../models/index');
const { confirmDeposit, registerPendingDeposit, markWithdrawalTransmitted } = require('../modules/balances/ledger/operations');
const { emitEvent } = require('../modules/events/emitEvent');
const createTransaccionBlockchainModel = require('../modules/wallets/blockchainTransaction.model');

const fakeModel = {};
initTransaccionBlockchain.mockReturnValue(fakeModel);
const sequelize = { transaction: jest.fn(), models: { Crypto: { findByPk: jest.fn() } } };
const BlockchainTransaction = createTransaccionBlockchainModel(sequelize);

beforeEach(() => jest.clearAllMocks());

describe('_creditDeposit — delega en confirmDeposit (pendiente→disponible)', () => {
  test('confirma el depósito por la cantidad exacta, en la transacción', async () => {
    BlockchainTransaction.update = jest.fn().mockResolvedValue([1]);
    sequelize.models.Crypto.findByPk.mockResolvedValue({ symbol: 'BTC' });

    const transaccion = { id: 't1', userId: 'u', cryptoId: 'c', amount: '0.2', status: 'confirmed' };
    await BlockchainTransaction._creditDeposit(transaccion, {});

    expect(confirmDeposit).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u', criptomonedaId: 'c', cantidad: '0.2', referencia: 'deposito-conf:t1' }),
      {}
    );
  });

  test('emite DepositConfirmed al outbox en la misma transacción', async () => {
    BlockchainTransaction.update = jest.fn().mockResolvedValue([1]);
    sequelize.models.Crypto.findByPk.mockResolvedValue({ symbol: 'BTC' });

    const tx = {};
    const transaccion = { id: 't2', userId: 'u2', cryptoId: 'c2', amount: '1.5', txHash: '0xabc', status: 'confirmed' };
    await BlockchainTransaction._creditDeposit(transaccion, tx);

    expect(emitEvent).toHaveBeenCalledWith(
      'DepositConfirmed',
      expect.objectContaining({ blockchainTransactionId: 't2', userId: 'u2', cryptoId: 'c2', amount: '1.5', txHash: '0xabc' }),
      expect.objectContaining({ transaction: tx, aggregateId: 't2' })
    );
  });
});

describe('createDeposit — emite DepositRegistered al outbox', () => {
  test('emite DepositRegistered con el id del nuevo depósito como aggregateId', async () => {
    const tx = { commit: jest.fn(), rollback: jest.fn() };
    sequelize.transaction.mockResolvedValue(tx);
    const nuevoDeposito = { id: 'd1', userId: 'u1', cryptoId: 'c1', amount: '0.5', txHash: '0xhash1', type: 'deposit', status: 'pending' };
    BlockchainTransaction.findOne = jest.fn().mockResolvedValue(null);
    BlockchainTransaction.create = jest.fn().mockResolvedValue(nuevoDeposito);
    BlockchainTransaction.getById = jest.fn().mockResolvedValue(nuevoDeposito);
    registerPendingDeposit.mockResolvedValue({});

    await BlockchainTransaction.createDeposit({ userId: 'u1', cryptoId: 'c1', amount: '0.5', txHash: '0xhash1' });

    expect(emitEvent).toHaveBeenCalledWith(
      'DepositRegistered',
      expect.objectContaining({ blockchainTransactionId: 'd1', userId: 'u1', cryptoId: 'c1', amount: '0.5', txHash: '0xhash1' }),
      expect.objectContaining({ transaction: tx, aggregateId: 'd1' })
    );
  });
});

describe('updateConfirmations — emite WithdrawalTransmitted al confirmar un retiro', () => {
  test('emite WithdrawalTransmitted cuando un withdrawal pasa a confirmed', async () => {
    const tx = { commit: jest.fn(), rollback: jest.fn() };
    sequelize.transaction.mockResolvedValue(tx);
    const transaccion = {
      id: 'w1', userId: 'u1', cryptoId: 'c1', amount: '0.3',
      txHash: '0xwith1', destinationAddress: 'addr1',
      type: 'withdrawal', status: 'processing',
      requiredConfirmations: 3,
    };
    BlockchainTransaction.findByPk = jest.fn().mockResolvedValue(transaccion);
    BlockchainTransaction.update = jest.fn().mockResolvedValue([1]);
    BlockchainTransaction.getById = jest.fn().mockResolvedValue(transaccion);
    markWithdrawalTransmitted.mockResolvedValue({});

    await BlockchainTransaction.updateConfirmations('w1', 3);

    expect(emitEvent).toHaveBeenCalledWith(
      'WithdrawalTransmitted',
      expect.objectContaining({
        blockchainTransactionId: 'w1', userId: 'u1', cryptoId: 'c1',
        amount: '0.3', destinationAddress: 'addr1', txHash: '0xwith1',
      }),
      expect.objectContaining({ transaction: tx, aggregateId: 'w1' })
    );
  });
});

describe('failWithdrawal — delega en unblockBalance', () => {
  test('devuelve la cantidad de bloqueado a disponible', async () => {
    sequelize.transaction.mockResolvedValue({ commit: jest.fn(), rollback: jest.fn() });
    BlockchainTransaction.findByPk = jest.fn().mockResolvedValue({
      userId: 'u', cryptoId: 'c', amount: '0.1', status: 'processing',
    });
    UserBalance.unblockBalance = jest.fn().mockResolvedValue({});
    BlockchainTransaction.update = jest.fn().mockResolvedValue([1]);
    BlockchainTransaction.getById = jest.fn().mockResolvedValue({ id: 'r1' });

    await BlockchainTransaction.failWithdrawal('r1', 'razon');

    expect(UserBalance.unblockBalance).toHaveBeenCalledWith('u', 'c', '0.1', expect.anything());
  });

  test('rechaza fallar un retiro ya confirmado (no crea dinero por doble-desbloqueo)', async () => {
    const rollback = jest.fn();
    sequelize.transaction.mockResolvedValue({ commit: jest.fn(), rollback });
    BlockchainTransaction.findByPk = jest.fn().mockResolvedValue({
      userId: 'u', cryptoId: 'c', amount: '0.1', status: 'confirmed',
    });
    UserBalance.unblockBalance = jest.fn().mockResolvedValue({});

    await expect(BlockchainTransaction.failWithdrawal('r1', 'razon')).rejects.toThrow(/confirmed/);
    expect(UserBalance.unblockBalance).not.toHaveBeenCalled();
    expect(rollback).toHaveBeenCalled();
  });
});
