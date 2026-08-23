// tests/transaccionesP2P.model.test.js
//
// Fase 1 — precisión monetaria en el P2P. createTransaction computaba el monto
// fiat con `cantidad * parseFloat(precioUnitario)` (float binario) y bloqueaba
// los fondos pasando `parseFloat(cantidad)` a BalanceUsuario.updateBalance,
// contaminando el monto antes del borde exacto. cantidad/montoFiat son DECIMAL:
// con money.js el fiat y los montos bloqueados son exactos como string.

jest.mock('../models/entities/transaccionP2P.entity');
jest.mock('../models/index', () => ({
  OfertaP2P: {},
  BalanceUsuario: {},
  Notificaciones: {},
}));

const initTransaccionP2P = require('../models/entities/transaccionP2P.entity');
const { OfertaP2P, BalanceUsuario, Notificaciones } = require('../models/index');
const createTransaccionP2PModel = require('../models/transaccionesP2P.model');

const fakeModel = {};
initTransaccionP2P.mockReturnValue(fakeModel);
const sequelize = { transaction: jest.fn() };
const TransaccionP2P = createTransaccionP2PModel(sequelize);

beforeEach(() => jest.clearAllMocks());

describe('TransaccionP2P.createTransaction — montoFiat y bloqueo exactos', () => {
  test('montoFiat = cantidad*precio y bloqueo negativo sin error de coma', async () => {
    sequelize.transaction.mockResolvedValue({ commit: jest.fn(), rollback: jest.fn(), finished: false });
    OfertaP2P.findByPk = jest.fn().mockResolvedValue({
      activa: true, cantidadMin: '0.01', cantidadMax: '10',
      criptomoneda: { symbol: 'BTC' }, monedaFiat: 'USD',
    });
    BalanceUsuario.getByUserAndCrypto = jest.fn().mockResolvedValue({ balanceDisponible: '5' });
    BalanceUsuario.updateBalance = jest.fn().mockResolvedValue();
    TransaccionP2P.create = jest.fn().mockResolvedValue({ id: 'tx1' });
    TransaccionP2P.getById = jest.fn().mockResolvedValue({ id: 'tx1' });
    Notificaciones.notifyBothParties = jest.fn().mockResolvedValue();

    await TransaccionP2P.createTransaction({
      ofertaId: 'o1', compradorId: 'c', vendedorId: 'v', criptomonedaId: 'crypto',
      cantidad: '0.1', precioUnitario: '0.2', metodoPagoId: 'm1',
    });

    // montoFiat = 0.1 * 0.2 = 0.02 (float: 0.020000000000000004)
    const createArg = TransaccionP2P.create.mock.calls[0][0];
    expect(createArg.montoFiat).toBe('0.02');
    expect(createArg.cantidad).toBe('0.1');

    // primer updateBalance: descuenta de 'disponible' un monto negativo exacto
    const firstUpdate = BalanceUsuario.updateBalance.mock.calls[0];
    expect(firstUpdate[2]).toBe('-0.1');
    expect(firstUpdate[3]).toBe('disponible');
  });
});
