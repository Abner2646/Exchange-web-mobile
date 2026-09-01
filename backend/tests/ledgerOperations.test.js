// tests/ledgerOperations.test.js
//
// Unit del asiento de swap (services/ledger/operations.js liquidarSwap): fija la
// PARTIDA DOBLE exacta (qué cuenta, qué signo, qué cripto) sin tocar la DB —
// postTransaction se mockea. Es la contraparte unit del test de integración del
// swap: acá se cazan errores de signo/cuenta en la construcción de las líneas.

jest.mock('../services/ledger/postingService', () => ({ postTransaction: jest.fn() }));

const { postTransaction } = require('../services/ledger/postingService');
const { PROPOSITOS } = require('../services/ledger/ledgerAccounts');
const { liquidarSwap, liquidarTrade } = require('../services/ledger/operations');

beforeEach(() => jest.clearAllMocks());

describe('liquidarSwap arma el asiento del swap (net-zero por cripto)', () => {
  test('compra: paga requiredQuote en quote, recibe base; treasury + fee_revenue', async () => {
    await liquidarSwap({
      usuarioId: 'u', criptoBaseId: 'BTC', criptoQuoteId: 'USDT',
      cantidadBase: '3', cantidadQuote: '0.3', comisionMonto: '0.003',
      requiredQuote: '0.303', netQuote: '0.297', tipo: 'compra', referencia: 'swap:1',
    }, 'tx');

    expect(postTransaction).toHaveBeenCalledTimes(1);
    const [asiento, transaction] = postTransaction.mock.calls[0];
    expect(transaction).toBe('tx');
    expect(asiento.tipo).toBe('swap');
    expect(asiento.referencia).toBe('swap:1');
    expect(asiento.lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: 'USDT', monto: '-0.303' });
    expect(asiento.lineas).toContainEqual({ ownerId: null, proposito: PROPOSITOS.TREASURY, criptomonedaId: 'USDT', monto: '0.3' });
    expect(asiento.lineas).toContainEqual({ ownerId: null, proposito: PROPOSITOS.FEE_REVENUE, criptomonedaId: 'USDT', monto: '0.003' });
    expect(asiento.lineas).toContainEqual({ ownerId: null, proposito: PROPOSITOS.TREASURY, criptomonedaId: 'BTC', monto: '-3' });
    expect(asiento.lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: 'BTC', monto: '3' });
  });

  test('venta: paga base, recibe netQuote en quote; treasury + fee_revenue', async () => {
    await liquidarSwap({
      usuarioId: 'u', criptoBaseId: 'BTC', criptoQuoteId: 'USDT',
      cantidadBase: '0.29', cantidadQuote: '0.29', comisionMonto: '0.0029',
      requiredQuote: '0.2929', netQuote: '0.2871', tipo: 'venta', referencia: 'swap:2',
    }, 'tx');

    const { lineas } = postTransaction.mock.calls[0][0];
    expect(lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: 'BTC', monto: '-0.29' });
    expect(lineas).toContainEqual({ ownerId: null, proposito: PROPOSITOS.TREASURY, criptomonedaId: 'BTC', monto: '0.29' });
    expect(lineas).toContainEqual({ ownerId: null, proposito: PROPOSITOS.TREASURY, criptomonedaId: 'USDT', monto: '-0.29' });
    expect(lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: 'USDT', monto: '0.2871' });
    expect(lineas).toContainEqual({ ownerId: null, proposito: PROPOSITOS.FEE_REVENUE, criptomonedaId: 'USDT', monto: '0.0029' });
  });
});

describe('liquidarTrade arma el asiento del trade spot user↔user', () => {
  test('con fees: vendedor(bloqueado)→comprador(disponible) en base, y viceversa en quote; fee_revenue por lado', async () => {
    await liquidarTrade({
      compradorId: 'comprador', vendedorId: 'vendedor', baseAssetId: 'BTC', quoteAssetId: 'USDT',
      cantidad: '1', montoQuote: '100', feeComprador: '0.001', feeVendedor: '0.1', referencia: 'trade:1',
    }, 'tx');

    const [asiento, transaction] = postTransaction.mock.calls[0];
    expect(transaction).toBe('tx');
    expect(asiento.tipo).toBe('liquidacion_trade');
    expect(asiento.referencia).toBe('trade:1');
    // BASE: el vendedor libera bloqueado, el comprador recibe neto, la casa cobra el fee taker.
    expect(asiento.lineas).toContainEqual({ ownerId: 'vendedor', proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: 'BTC', monto: '-1' });
    expect(asiento.lineas).toContainEqual({ ownerId: 'comprador', proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: 'BTC', monto: '0.999' });
    expect(asiento.lineas).toContainEqual({ ownerId: null, proposito: PROPOSITOS.FEE_REVENUE, criptomonedaId: 'BTC', monto: '0.001' });
    // QUOTE: el comprador libera bloqueado, el vendedor recibe neto, la casa cobra el fee maker.
    expect(asiento.lineas).toContainEqual({ ownerId: 'comprador', proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: 'USDT', monto: '-100' });
    expect(asiento.lineas).toContainEqual({ ownerId: 'vendedor', proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: 'USDT', monto: '99.9' });
    expect(asiento.lineas).toContainEqual({ ownerId: null, proposito: PROPOSITOS.FEE_REVENUE, criptomonedaId: 'USDT', monto: '0.1' });
  });

  test('sin fees: no emite líneas de fee_revenue (sólo las 4 patas de usuario)', async () => {
    await liquidarTrade({
      compradorId: 'comprador', vendedorId: 'vendedor', baseAssetId: 'BTC', quoteAssetId: 'USDT',
      cantidad: '1', montoQuote: '100', feeComprador: '0', feeVendedor: '0', referencia: 'trade:2',
    });

    const { lineas } = postTransaction.mock.calls[0][0];
    expect(lineas).toHaveLength(4);
    expect(lineas.some((l) => l.proposito === PROPOSITOS.FEE_REVENUE)).toBe(false);
  });
});
