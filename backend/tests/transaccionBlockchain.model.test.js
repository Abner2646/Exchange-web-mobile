// tests/transaccionBlockchain.model.test.js
//
// Write-flip (Paso B). El settlement (acreditar deposito / fallar retiro) ya no
// hace aritmetica cruda sobre balances_users: delega en los metodos del modelo
// (updateBalance/unblockBalance), que postean al ledger. Este unit test verifica
// esa DELEGACION con los montos correctos; la exactitud monetaria y el resultado
// en el ledger se cubren en tests/integration/ledgerWriteFlip.integration.test.js.

jest.mock('../models/entities/transaccionBlockchain.entity');
jest.mock('../models/index', () => ({ BalanceUsuario: {} }));

const initTransaccionBlockchain = require('../models/entities/transaccionBlockchain.entity');
const { BalanceUsuario } = require('../models/index');
const createTransaccionBlockchainModel = require('../models/transaccionBlockchain.model');

const fakeModel = {};
initTransaccionBlockchain.mockReturnValue(fakeModel);
const sequelize = { transaction: jest.fn(), models: { Criptomoneda: { findByPk: jest.fn() } } };
const TransaccionBlockchain = createTransaccionBlockchainModel(sequelize);

beforeEach(() => jest.clearAllMocks());

describe('_acreditarDeposito — delega en updateBalance', () => {
  test('acredita la cantidad exacta al funding:disponible del usuario', async () => {
    BalanceUsuario.updateBalance = jest.fn().mockResolvedValue({});
    TransaccionBlockchain.update = jest.fn().mockResolvedValue([1]);
    sequelize.models.Criptomoneda.findByPk.mockResolvedValue({ symbol: 'BTC' });

    const transaccion = { id: 't1', userId: 'u', criptomonedaId: 'c', cantidad: '0.2', estado: 'confirmado' };
    await TransaccionBlockchain._acreditarDeposito(transaccion, {});

    expect(BalanceUsuario.updateBalance).toHaveBeenCalledWith('u', 'c', '0.2', 'disponible', {});
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
