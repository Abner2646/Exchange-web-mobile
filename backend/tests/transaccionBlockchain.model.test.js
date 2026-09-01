// tests/transaccionBlockchain.model.test.js
//
// Write-flip (Paso B) + Paso D. El settlement delega en operaciones de dominio
// del ledger: acreditar depósito → confirmarDeposito (pendiente→disponible);
// fallar retiro → unblockBalance. Este unit test verifica esa DELEGACION; el
// resultado en el ledger se cubre en ledgerWriteFlip.integration.test.js.

jest.mock('../models/entities/transaccionBlockchain.entity');
jest.mock('../models/index', () => ({ BalanceUsuario: {} }));
jest.mock('../services/ledger/operations', () => ({
  confirmarDeposito: jest.fn(),
  registrarDepositoPendiente: jest.fn(),
}));

const initTransaccionBlockchain = require('../models/entities/transaccionBlockchain.entity');
const { BalanceUsuario } = require('../models/index');
const { confirmarDeposito } = require('../services/ledger/operations');
const createTransaccionBlockchainModel = require('../models/transaccionBlockchain.model');

const fakeModel = {};
initTransaccionBlockchain.mockReturnValue(fakeModel);
const sequelize = { transaction: jest.fn(), models: { Criptomoneda: { findByPk: jest.fn() } } };
const TransaccionBlockchain = createTransaccionBlockchainModel(sequelize);

beforeEach(() => jest.clearAllMocks());

describe('_acreditarDeposito — delega en confirmarDeposito (pendiente→disponible)', () => {
  test('confirma el depósito por la cantidad exacta, en la transacción', async () => {
    TransaccionBlockchain.update = jest.fn().mockResolvedValue([1]);
    sequelize.models.Criptomoneda.findByPk.mockResolvedValue({ symbol: 'BTC' });

    const transaccion = { id: 't1', userId: 'u', criptomonedaId: 'c', cantidad: '0.2', estado: 'confirmado' };
    await TransaccionBlockchain._acreditarDeposito(transaccion, {});

    expect(confirmarDeposito).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u', criptomonedaId: 'c', cantidad: '0.2', referencia: 'deposito-conf:t1' }),
      {}
    );
  });
});

describe('failWithdrawal — delega en unblockBalance', () => {
  test('devuelve la cantidad de bloqueado a disponible', async () => {
    sequelize.transaction.mockResolvedValue({ commit: jest.fn(), rollback: jest.fn() });
    TransaccionBlockchain.findByPk = jest.fn().mockResolvedValue({
      userId: 'u', criptomonedaId: 'c', cantidad: '0.1',
    });
    BalanceUsuario.unblockBalance = jest.fn().mockResolvedValue({});
    TransaccionBlockchain.update = jest.fn().mockResolvedValue([1]);
    TransaccionBlockchain.getById = jest.fn().mockResolvedValue({ id: 'r1' });

    await TransaccionBlockchain.failWithdrawal('r1', 'razon');

    expect(BalanceUsuario.unblockBalance).toHaveBeenCalledWith('u', 'c', '0.1', expect.anything());
  });
});
