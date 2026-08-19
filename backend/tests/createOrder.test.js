// tests/createOrder.test.js
//
// Cubre AUDITORIA_BACKEND.md Críticos #4 y #6: createOrder tenía "tipo"
// hardcodeado a venta (una compra debitaba y acreditaba al revés de lo
// pedido) y el límite diario estaba deshabilitado. También cubre Altos #3
// (req.usuario vs req.user) en checkTransactionLimit.
//
// Los modelos de Sequelize se mockean por completo: lo que se está
// probando es la lógica de negocio del controller (qué balance se debita,
// cuál se acredita, en qué signo), no la capa de persistencia — eso es
// trabajo de un test de integración con DB real (Fase 2 del roadmap).

jest.mock('../models/index.js', () => ({
  IntercambioExchange: { create: jest.fn(), getDailyVolume: jest.fn() },
  Usuario: { findByPk: jest.fn() },
  ParExchange: { findByPk: jest.fn() },
  BalanceUsuario: { findOne: jest.fn(), updateBalance: jest.fn() },
  WalletMaestra: { findOne: jest.fn(), addToBalance: jest.fn() },
  Criptomoneda: {},
  sequelize: { transaction: jest.fn() },
}));

const {
  IntercambioExchange,
  Usuario,
  ParExchange,
  BalanceUsuario,
  WalletMaestra,
  sequelize,
} = require('../models/index.js');

const { createOrder, checkTransactionLimit } = require('../controllers/intercambioExchange.controller');

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

const CRIPTO_BASE_ID = 'base-crypto-id';
const CRIPTO_QUOTE_ID = 'quote-crypto-id';
const PAR_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-1';

function setupCommonMocks({ limiteDiarioUsd = 1000000, dailyVolume = 0 } = {}) {
  const transaction = { commit: jest.fn(), rollback: jest.fn() };
  sequelize.transaction.mockResolvedValue(transaction);

  ParExchange.findByPk.mockResolvedValue({
    activo: true,
    precioActual: '100',
    comisionPorcentaje: 1, // 1%
    criptoBaseId: CRIPTO_BASE_ID,
    criptoQuoteId: CRIPTO_QUOTE_ID,
    criptoBase: { symbol: 'BTC' },
    criptoQuote: { symbol: 'USDT' },
  });

  Usuario.findByPk.mockResolvedValue({ activo: true, limiteDiarioUsd });
  IntercambioExchange.getDailyVolume.mockResolvedValue(dailyVolume);
  IntercambioExchange.create.mockImplementation(async (data) => ({
    ...data,
    toJSON: () => data,
  }));
  WalletMaestra.findOne.mockResolvedValue({ id: 'wallet-maestra-quote' });

  return transaction;
}

describe('createOrder', () => {
  beforeEach(() => jest.clearAllMocks());

  test('tipo "compra" debita quote y acredita base (no al revés)', async () => {
    setupCommonMocks();
    // Balance quote suficiente para pagar 1 BTC * 100 + 1% comisión = 101
    BalanceUsuario.findOne.mockResolvedValue({ balanceDisponible: '200' });

    const req = { user: { id: USER_ID }, body: { parId: PAR_ID, tipo: 'compra', cantidadBase: 1 } };
    const res = mockRes();

    await createOrder(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.tipo).toBe('compra');

    // Débito en quote (negativo) y crédito en base (positivo) — exactamente
    // lo que "comprar" tiene que hacer.
    expect(BalanceUsuario.updateBalance).toHaveBeenCalledWith(
      USER_ID, CRIPTO_QUOTE_ID, -101, 'disponible', expect.anything()
    );
    expect(BalanceUsuario.updateBalance).toHaveBeenCalledWith(
      USER_ID, CRIPTO_BASE_ID, 1, 'disponible', expect.anything()
    );
  });

  test('tipo "venta" debita base y acredita quote', async () => {
    setupCommonMocks();
    BalanceUsuario.findOne.mockResolvedValue({ balanceDisponible: '200' });

    const req = { user: { id: USER_ID }, body: { parId: PAR_ID, tipo: 'venta', cantidadBase: 1 } };
    const res = mockRes();

    await createOrder(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.tipo).toBe('venta');

    expect(BalanceUsuario.updateBalance).toHaveBeenCalledWith(
      USER_ID, CRIPTO_BASE_ID, -1, 'disponible', expect.anything()
    );
    expect(BalanceUsuario.updateBalance).toHaveBeenCalledWith(
      USER_ID, CRIPTO_QUOTE_ID, 99, 'disponible', expect.anything()
    );
  });

  test('la comisión se acredita en la misma transacción de la orden', async () => {
    const transaction = setupCommonMocks();
    BalanceUsuario.findOne.mockResolvedValue({ balanceDisponible: '200' });

    const req = { user: { id: USER_ID }, body: { parId: PAR_ID, tipo: 'venta', cantidadBase: 1 } };
    await createOrder(req, mockRes());

    expect(WalletMaestra.addToBalance).toHaveBeenCalledWith('wallet-maestra-quote', 1, transaction);
  });

  test('rechaza la orden si supera el límite diario (chequeo ya no está deshabilitado)', async () => {
    setupCommonMocks({ limiteDiarioUsd: 50, dailyVolume: 0 });
    BalanceUsuario.findOne.mockResolvedValue({ balanceDisponible: '200' });

    // cantidadQuote = 1 * 100 = 100, supera el límite de 50
    const req = { user: { id: USER_ID }, body: { parId: PAR_ID, tipo: 'venta', cantidadBase: 1 } };
    const res = mockRes();

    await createOrder(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Límite diario excedido');
    expect(BalanceUsuario.updateBalance).not.toHaveBeenCalled();
  });
});

describe('checkTransactionLimit', () => {
  beforeEach(() => jest.clearAllMocks());

  test('usa req.user.id (no req.usuario.id) y no revienta', async () => {
    IntercambioExchange.getDailyVolume.mockResolvedValue(0);
    Usuario.findByPk.mockResolvedValue({ limiteDiarioUsd: 1000 });

    const req = { user: { id: USER_ID }, body: { cantidadQuote: 100 } };
    const res = mockRes();

    await checkTransactionLimit(req, res);

    expect(res.statusCode).toBeNull(); // res.json() sin status() previo = 200 implícito
    expect(res.body.canTransact).toBe(true);
  });

  test('devuelve canTransact:false cuando se supera el límite', async () => {
    IntercambioExchange.getDailyVolume.mockResolvedValue(950);
    Usuario.findByPk.mockResolvedValue({ limiteDiarioUsd: 1000 });

    const req = { user: { id: USER_ID }, body: { cantidadQuote: 100 } };
    const res = mockRes();

    await checkTransactionLimit(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.canTransact).toBe(false);
  });
});
