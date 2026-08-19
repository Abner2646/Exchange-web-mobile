// tests/transaccionesP2PController.test.js
//
// Cubre AUDITORIA_BACKEND.md Críticos #10 y #11:
// - getMyTransacciones y getTransactionHistory usaban Op/Criptomoneda/Usuario
//   sin importarlos — ReferenceError garantizado en ambas rutas activas.
// - updateTransaccionStatus y lockCryptos llamaban a métodos inexistentes
//   del modelo (TransaccionP2P.updateStatus/.lockCryptos) — se eliminaron
//   por completo (el bloqueo de fondos ya pasa dentro de createTransaction,
//   y las transiciones de estado específicas ya existen y funcionan).

jest.mock('../models/index.js', () => ({
  TransaccionP2P: { findAndCountAll: jest.fn(), getAll: jest.fn() },
  Criptomoneda: {},
  Usuario: {},
  OfertaP2P: {},
}));

const { TransaccionP2P } = require('../models/index.js');
const controller = require('../controllers/transaccionesP2P.controller');

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

describe('getMyTransacciones', () => {
  beforeEach(() => jest.clearAllMocks());

  test('no revienta con ReferenceError (Op/Criptomoneda/Usuario ahora están importados)', async () => {
    TransaccionP2P.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    const req = { user: { id: 'u1' }, query: {} };
    const res = mockRes();

    await controller.getMyTransacciones(req, res);

    expect(res.statusCode).not.toBe(500);
    expect(res.body.total).toBe(0);
  });

  test('arma el where con Op.or sobre compradorId/vendedorId', async () => {
    TransaccionP2P.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    const req = { user: { id: 'u1' }, query: {} };
    await controller.getMyTransacciones(req, mockRes());

    const callArgs = TransaccionP2P.findAndCountAll.mock.calls[0][0];
    expect(callArgs.where[Object.getOwnPropertySymbols(callArgs.where)[0]]).toEqual([
      { compradorId: 'u1' },
      { vendedorId: 'u1' },
    ]);
  });
});

describe('getTransactionHistory', () => {
  beforeEach(() => jest.clearAllMocks());

  test('no revienta con ReferenceError', async () => {
    TransaccionP2P.getAll.mockResolvedValue({ transacciones: [], total: 0 });

    const req = { user: { id: 'u1' }, params: { otroUsuarioId: 'u2' }, query: {} };
    const res = mockRes();

    await controller.getTransactionHistory(req, res);

    expect(res.statusCode).not.toBe(500);
  });
});

describe('rutas eliminadas (código muerto que llamaba a métodos inexistentes)', () => {
  test('updateTransaccionStatus y lockCryptos ya no se exportan', () => {
    expect(controller.updateTransaccionStatus).toBeUndefined();
    expect(controller.lockCryptos).toBeUndefined();
  });
});
