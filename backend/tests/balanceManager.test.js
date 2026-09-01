// tests/balanceManager.test.js
//
// Fase 1 — migración de balanceManager a money.js: aritmética exacta con
// decimal.js y montos como string canónico en los deltas que mueven plata y en
// los valores de lectura. Endurecido 2026-08-31 con mutation testing (Stryker):
// además de los montos exactos, se aseveran los guards de rechazo (precio
// inválido, balance insuficiente, par/balance ausente), el flag `success` de
// retorno, el lado (buy→quote / sell→base) en unlock y checkSufficientBalance, el
// uso del price pasado (no lastPrice), y el borde disponible==requerido — todo lo
// que un mutante lógico hacía pasar antes sin que ningún test lo atrapara.

jest.mock('../models', () => ({
  BalanceUsuario: {
    hasAvailableBalance: jest.fn(),
    blockBalance: jest.fn(),
    unblockBalance: jest.fn(),
    updateBalance: jest.fn(),
    getByUserAndCrypto: jest.fn(),
  },
  TradingPair: { findByPk: jest.fn() },
  sequelize: {},
}));

// Paso D: el settlement del trade liquida en el ledger vía liquidarTrade
// (comprador↔vendedor + fee_revenue por lado). Se mockea la operación de dominio
// y se asevera la delegación; el resultado real en el ledger lo cubre el test de
// integración de matching.
jest.mock('../services/ledger/operations', () => ({ liquidarTrade: jest.fn() }));

const { BalanceUsuario, TradingPair } = require('../models');
const { liquidarTrade } = require('../services/ledger/operations');
const balanceManager = require('../services/trading/balanceManager.service');

beforeEach(() => jest.clearAllMocks());

const pair = {
  quoteAssetId: 'q',
  baseAssetId: 'base',
  lastPrice: '0.2',
  takerFeePercent: '0.2',
};

describe('lockBalanceForOrder — monto a bloquear exacto', () => {
  test('compra market: bloquea quantity*price sin fee (el fee taker se cobra del base al liquidar), sin error de coma', async () => {
    BalanceUsuario.hasAvailableBalance.mockResolvedValue(true);

    const r = await balanceManager.lockBalanceForOrder({
      userId: 'u', tradingPair: pair, side: 'buy', quantity: '0.1', price: null,
    });

    // 0.1*0.2 = 0.02 exacto (float daría 0.020000000000000004). Sin reserva de
    // fee en quote: el fee taker sale del base recibido al liquidar (Radar #12a).
    expect(r.success).toBe(true);
    expect(r.assetLocked).toBe('q');
    expect(r.amountLocked).toBe('0.02');
    expect(BalanceUsuario.blockBalance).toHaveBeenCalledWith('u', 'q', '0.02', null);
  });

  test('venta: bloquea la cantidad de base asset como string', async () => {
    BalanceUsuario.hasAvailableBalance.mockResolvedValue(true);

    const r = await balanceManager.lockBalanceForOrder({
      userId: 'u', tradingPair: pair, side: 'sell', quantity: '0.1', price: null,
    });

    expect(r.success).toBe(true);
    expect(r.assetLocked).toBe('base');
    expect(r.amountLocked).toBe('0.1');
    expect(BalanceUsuario.blockBalance).toHaveBeenCalledWith('u', 'base', '0.1', null);
  });

  test('precio no positivo (0) → success:false con error de precio, no bloquea', async () => {
    // rawPrice = '0' (truthy) pero compare('0','0') <= 0 → guard dispara.
    const r = await balanceManager.lockBalanceForOrder({
      userId: 'u', tradingPair: pair, side: 'buy', quantity: '0.1', price: '0',
    });

    expect(r.success).toBe(false);
    expect(r.error).toMatch(/determinar el precio/i);
    expect(BalanceUsuario.blockBalance).not.toHaveBeenCalled();
  });

  test('balance insuficiente → success:false, no bloquea', async () => {
    BalanceUsuario.hasAvailableBalance.mockResolvedValue(false);

    const r = await balanceManager.lockBalanceForOrder({
      userId: 'u', tradingPair: pair, side: 'buy', quantity: '0.1', price: '0.2',
    });

    expect(r.success).toBe(false);
    expect(r.error).toMatch(/insuficiente/i);
    expect(BalanceUsuario.blockBalance).not.toHaveBeenCalled();
  });
});

describe('unlockBalanceFromOrder — monto a desbloquear exacto', () => {
  test('compra: desbloquea quantityRemaining * order.price (no lastPrice), sin error de coma', async () => {
    const order = {
      side: 'buy', tradingPairId: 'p', quantityRemaining: '0.1', price: '0.3',
      feePercent: '0.2', userId: 'u',
      tradingPair: { quoteAssetId: 'q', baseAssetId: 'base', lastPrice: '0.2' },
    };
    const tx = {};

    const r = await balanceManager.unlockBalanceFromOrder(order, tx);

    expect(r.success).toBe(true);
    expect(r.assetUnlocked).toBe('q');
    expect(r.amountUnlocked).toBe('0.03'); // 0.1*0.3 (order.price), NO 0.1*0.2 (lastPrice)
    expect(BalanceUsuario.unblockBalance).toHaveBeenCalledWith('u', 'q', '0.03', tx);
  });

  test('venta: desbloquea la cantidad en base asset', async () => {
    const order = {
      side: 'sell', tradingPairId: 'p', quantityRemaining: '0.1', userId: 'u',
      tradingPair: { quoteAssetId: 'q', baseAssetId: 'base', lastPrice: '0.2' },
    };
    const tx = {};

    const r = await balanceManager.unlockBalanceFromOrder(order, tx);

    expect(r.success).toBe(true);
    expect(r.assetUnlocked).toBe('base');
    expect(r.amountUnlocked).toBe('0.1');
    expect(BalanceUsuario.unblockBalance).toHaveBeenCalledWith('u', 'base', '0.1', tx);
  });

  test('sin trading pair (ni en el order ni en la DB) → lanza "no encontrado"', async () => {
    TradingPair.findByPk.mockResolvedValue(null);
    const order = { side: 'buy', tradingPairId: 'p', quantityRemaining: '0.1', price: '0.2', feePercent: '0.2', userId: 'u' };

    await expect(balanceManager.unlockBalanceFromOrder(order, {})).rejects.toThrow(/no encontrado/i);
  });
});

describe('updateBalancesAfterTrade — delega la liquidación al ledger', () => {
  test('llama a liquidarTrade con montoQuote y fees exactos, en la transacción, y devuelve success:true', async () => {
    const trade = {
      id: 't1', buyerId: 'b', sellerId: 's', tradingPairId: 'p',
      quantity: '0.1', price: '0.2', buyerFee: '0.0001', sellerFee: '0.00004',
    };
    const buyOrder = { tradingPair: { quoteAssetId: 'q', baseAssetId: 'base' } };
    const tx = {};

    const r = await balanceManager.updateBalancesAfterTrade(trade, buyOrder, {}, tx);

    expect(r.success).toBe(true);
    expect(liquidarTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        compradorId: 'b',
        vendedorId: 's',
        baseAssetId: 'base',
        quoteAssetId: 'q',
        cantidad: '0.1',
        montoQuote: '0.02', // 0.1*0.2 exacto (float daría 0.020000000000000004)
        feeComprador: '0.0001',
        feeVendedor: '0.00004',
        referencia: 'trade:t1',
      }),
      tx
    );
  });
});

describe('checkSufficientBalance — requerido exacto como string', () => {
  test('compra: required = cantidad * price (usa el price pasado, no lastPrice); pide quote asset', async () => {
    TradingPair.findByPk.mockResolvedValue(pair);
    BalanceUsuario.getByUserAndCrypto.mockResolvedValue({ balanceDisponible: '0.05' });

    // price 0.3 distinto de lastPrice 0.2.
    const r = await balanceManager.checkSufficientBalance('u', 'p', 'buy', '0.1', '0.3');

    expect(r.required).toBe('0.03'); // 0.1*0.3, no 0.1*0.2
    expect(r.available).toBe('0.05');
    expect(r.sufficient).toBe(true);
    expect(BalanceUsuario.getByUserAndCrypto).toHaveBeenCalledWith('u', 'q'); // quote para compra
  });

  test('venta: required = cantidad (base asset)', async () => {
    TradingPair.findByPk.mockResolvedValue(pair);
    BalanceUsuario.getByUserAndCrypto.mockResolvedValue({ balanceDisponible: '1' });

    const r = await balanceManager.checkSufficientBalance('u', 'p', 'sell', '0.1', '0.2');

    expect(r.required).toBe('0.1');
    expect(r.sufficient).toBe(true);
    expect(BalanceUsuario.getByUserAndCrypto).toHaveBeenCalledWith('u', 'base'); // base para venta
  });

  test('insuficiente: disponible < requerido → sufficient false', async () => {
    TradingPair.findByPk.mockResolvedValue(pair);
    BalanceUsuario.getByUserAndCrypto.mockResolvedValue({ balanceDisponible: '0.01' }); // < 0.02

    const r = await balanceManager.checkSufficientBalance('u', 'p', 'buy', '0.1', '0.2');

    expect(r.sufficient).toBe(false);
    expect(r.error).toMatch(/insuficiente/i);
  });

  test('borde: disponible == requerido → sufficient true', async () => {
    TradingPair.findByPk.mockResolvedValue(pair);
    BalanceUsuario.getByUserAndCrypto.mockResolvedValue({ balanceDisponible: '0.02' }); // == 0.02

    const r = await balanceManager.checkSufficientBalance('u', 'p', 'buy', '0.1', '0.2');

    expect(r.sufficient).toBe(true);
  });

  test('sin trading pair → sufficient false con error "no encontrado"', async () => {
    TradingPair.findByPk.mockResolvedValue(null);

    const r = await balanceManager.checkSufficientBalance('u', 'p', 'buy', '0.1', '0.2');

    expect(r.sufficient).toBe(false);
    expect(r.error).toMatch(/no encontrado/i);
  });

  test('sin balance en la cripto → sufficient false, available "0"', async () => {
    TradingPair.findByPk.mockResolvedValue(pair);
    BalanceUsuario.getByUserAndCrypto.mockResolvedValue(null);

    const r = await balanceManager.checkSufficientBalance('u', 'p', 'buy', '0.1', '0.2');

    expect(r.sufficient).toBe(false);
    expect(r.available).toBe('0');
    expect(r.error).toMatch(/no tienes balance/i);
  });
});

describe('getTradingBalance — lectura como string exacto', () => {
  test('total = disponible + bloqueado, sin error de coma', async () => {
    BalanceUsuario.getByUserAndCrypto.mockResolvedValue({
      balanceDisponible: '0.1', balanceBloqueado: '0.2',
    });

    const r = await balanceManager.getTradingBalance('u', 'c');

    expect(r).toEqual({ available: '0.1', locked: '0.2', total: '0.3' });
  });

  test('sin balance → devuelve ceros (no lanza)', async () => {
    BalanceUsuario.getByUserAndCrypto.mockResolvedValue(null);

    const r = await balanceManager.getTradingBalance('u', 'c');

    expect(r).toEqual({ available: '0', locked: '0', total: '0' });
  });
});
