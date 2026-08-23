// tests/transaccionBlockchain.model.test.js
//
// Fase 1 — precisión monetaria. Este modelo es el SETTLEMENT: acredita/debita
// BalanceUsuario cuando un depósito/retiro on-chain cambia de estado, y lo hacía
// con aritmética float directa (parseFloat(saldo) ± parseFloat(cantidad)),
// saltándose los métodos exactos de BalanceUsuario. Los saldos son DECIMAL(28,8):
// con money.js el crédito/débito es exacto y se guarda como string canónico.

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

describe('_acreditarDeposito — acredita el depósito exacto', () => {
  test('disponible 0.1 + cantidad 0.2 = "0.3", no 0.30000000000000004', async () => {
    const balance = { id: 'b1', balanceDisponible: '0.1', balanceBloqueado: '0' };
    BalanceUsuario.findOrCreate = jest.fn().mockResolvedValue([balance]);
    BalanceUsuario.update = jest.fn().mockResolvedValue([1]);
    BalanceUsuario.findByPk = jest.fn().mockResolvedValue(balance);
    TransaccionBlockchain.update = jest.fn().mockResolvedValue([1]);
    sequelize.models.Criptomoneda.findByPk.mockResolvedValue({ symbol: 'BTC' });

    const transaccion = { id: 't1', userId: 'u', criptomonedaId: 'c', cantidad: '0.2', estado: 'confirmado' };
    await TransaccionBlockchain._acreditarDeposito(transaccion, {});

    const arg = BalanceUsuario.update.mock.calls[0][0];
    expect(arg.balanceDisponible).toBe('0.3');
  });
});

describe('failWithdrawal — refunda el retiro exacto (disponible += / bloqueado -=)', () => {
  test('disponible 0.2+0.1="0.3", bloqueado 0.3-0.1="0.2", sin error de coma', async () => {
    sequelize.transaction.mockResolvedValue({ commit: jest.fn(), rollback: jest.fn() });
    TransaccionBlockchain.findByPk = jest.fn().mockResolvedValue({
      userId: 'u', criptomonedaId: 'c', cantidad: '0.1',
    });
    BalanceUsuario.findOne = jest.fn().mockResolvedValue({
      id: 'b1', balanceDisponible: '0.2', balanceBloqueado: '0.3',
    });
    BalanceUsuario.update = jest.fn().mockResolvedValue([1]);
    TransaccionBlockchain.update = jest.fn().mockResolvedValue([1]);
    TransaccionBlockchain.getById = jest.fn().mockResolvedValue({ id: 'r1' });

    await TransaccionBlockchain.failWithdrawal('r1', 'razon');

    const arg = BalanceUsuario.update.mock.calls[0][0];
    expect(arg.balanceDisponible).toBe('0.3');
    expect(arg.balanceBloqueado).toBe('0.2');
  });
});
