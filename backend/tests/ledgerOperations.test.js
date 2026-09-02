// tests/ledgerOperations.test.js
//
// Unit del asiento de swap (services/ledger/operations.js liquidarSwap): fija la
// PARTIDA DOBLE exacta (qué cuenta, qué signo, qué cripto) sin tocar la DB —
// postTransaction se mockea. Es la contraparte unit del test de integración del
// swap: acá se cazan errores de signo/cuenta en la construcción de las líneas.

jest.mock('../services/ledger/postingService', () => ({ postTransaction: jest.fn() }));

const { postTransaction } = require('../services/ledger/postingService');
const { PROPOSITOS } = require('../services/ledger/ledgerAccounts');
const {
  liquidarSwap, liquidarTrade, marcarRetiroTransmitido,
  registrarDepositoPendiente, confirmarDeposito, transferirInterno, liquidarP2P,
  acreditarFaucet, transferirEntreCompartimentos, reservarParaOrden, liberarReserva,
} = require('../services/ledger/operations');

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
    expect(asiento.descripcion).toBe('Swap compra');
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

    const asiento = postTransaction.mock.calls[0][0];
    expect(asiento.descripcion).toBe('Swap venta');
    const { lineas } = asiento;
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
    expect(asiento.descripcion).toBe('Trade spot');
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

describe('marcarRetiroTransmitido arma el asiento del retiro on-chain', () => {
  test('sin fee: funding:bloqueado −A → external_onchain +A (2 líneas)', async () => {
    await marcarRetiroTransmitido({
      userId: 'u', criptomonedaId: 'BTC', cantidad: '1', referencia: 'retiro:1',
    }, 'tx');

    const [asiento, transaction] = postTransaction.mock.calls[0];
    expect(transaction).toBe('tx');
    expect(asiento.tipo).toBe('retiro');
    expect(asiento.descripcion).toBe('Retiro transmitido on-chain');
    expect(asiento.lineas).toHaveLength(2);
    expect(asiento.lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: 'BTC', monto: '-1' });
    expect(asiento.lineas).toContainEqual({ ownerId: null, proposito: PROPOSITOS.EXTERNAL_ONCHAIN, criptomonedaId: 'BTC', monto: '1' });
  });

  test('con fee de retiro: external_onchain +(A−wf) y fee_revenue +wf', async () => {
    await marcarRetiroTransmitido({
      userId: 'u', criptomonedaId: 'BTC', cantidad: '1', feeRetiro: '0.1', referencia: 'retiro:2',
    });

    const { lineas } = postTransaction.mock.calls[0][0];
    expect(lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: 'BTC', monto: '-1' });
    expect(lineas).toContainEqual({ ownerId: null, proposito: PROPOSITOS.EXTERNAL_ONCHAIN, criptomonedaId: 'BTC', monto: '0.9' });
    expect(lineas).toContainEqual({ ownerId: null, proposito: PROPOSITOS.FEE_REVENUE, criptomonedaId: 'BTC', monto: '0.1' });
  });
});

describe('registrarDepositoPendiente / confirmarDeposito arman los asientos del depósito', () => {
  test('detección: external_onchain −A → funding:pendiente +A', async () => {
    await registrarDepositoPendiente({ userId: 'u', criptomonedaId: 'BTC', cantidad: '1.5', referencia: 'dep-pend:1' }, 'tx');

    const [asiento, transaction] = postTransaction.mock.calls[0];
    expect(transaction).toBe('tx');
    expect(asiento.tipo).toBe('deposito');
    expect(asiento.descripcion).toBe('Depósito detectado (pendiente)');
    expect(asiento.lineas).toContainEqual({ ownerId: null, proposito: PROPOSITOS.EXTERNAL_ONCHAIN, criptomonedaId: 'BTC', monto: '-1.5' });
    expect(asiento.lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.FUNDING_PENDIENTE, criptomonedaId: 'BTC', monto: '1.5' });
  });

  test('confirmación: funding:pendiente −A → funding:disponible +A', async () => {
    await confirmarDeposito({ userId: 'u', criptomonedaId: 'BTC', cantidad: '1.5', referencia: 'dep-conf:1' });

    const asiento = postTransaction.mock.calls[0][0];
    expect(asiento.tipo).toBe('deposito');
    expect(asiento.descripcion).toBe('Depósito confirmado');
    const { lineas } = asiento;
    expect(lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.FUNDING_PENDIENTE, criptomonedaId: 'BTC', monto: '-1.5' });
    expect(lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: 'BTC', monto: '1.5' });
  });
});

describe('transferirInterno arma el asiento de la transferencia user↔user', () => {
  test('remitente disponible −A → destinatario disponible +A (sin suspense)', async () => {
    await transferirInterno({
      remitenteId: 'from', destinatarioId: 'to', criptomonedaId: 'BTC', cantidad: '50', referencia: 'transferencia:1',
    }, 'tx');

    const [asiento, transaction] = postTransaction.mock.calls[0];
    expect(transaction).toBe('tx');
    expect(asiento.tipo).toBe('transferencia');
    expect(asiento.descripcion).toBe('Transferencia interna');
    expect(asiento.lineas).toHaveLength(2);
    expect(asiento.lineas).toContainEqual({ ownerId: 'from', proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: 'BTC', monto: '-50' });
    expect(asiento.lineas).toContainEqual({ ownerId: 'to', proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: 'BTC', monto: '50' });
  });
});

describe('liquidarP2P arma el asiento de la transacción P2P', () => {
  test('cripto bloqueado del vendedor → disponible del comprador (sin suspense)', async () => {
    await liquidarP2P({
      vendedorId: 'v', compradorId: 'c', criptomonedaId: 'BTC', cantidad: '0.5', referencia: 'p2p:1',
    }, 'tx');

    const [asiento, transaction] = postTransaction.mock.calls[0];
    expect(transaction).toBe('tx');
    expect(asiento.tipo).toBe('liquidacion_p2p');
    expect(asiento.descripcion).toBe('Liquidación P2P');
    expect(asiento.lineas).toHaveLength(2);
    expect(asiento.lineas).toContainEqual({ ownerId: 'v', proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: 'BTC', monto: '-0.5' });
    expect(asiento.lineas).toContainEqual({ ownerId: 'c', proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: 'BTC', monto: '0.5' });
  });
});

describe('acreditarFaucet arma el asiento del faucet de testnet', () => {
  test('external_onchain −A → funding:disponible +A (sin suspense)', async () => {
    await acreditarFaucet({ userId: 'u', criptomonedaId: 'BTC', cantidad: '1', referencia: 'faucet:1' }, 'tx');

    const [asiento, transaction] = postTransaction.mock.calls[0];
    expect(transaction).toBe('tx');
    expect(asiento.tipo).toBe('deposito');
    expect(asiento.descripcion).toBe('Faucet testnet');
    expect(asiento.lineas).toHaveLength(2);
    expect(asiento.lineas).toContainEqual({ ownerId: null, proposito: PROPOSITOS.EXTERNAL_ONCHAIN, criptomonedaId: 'BTC', monto: '-1' });
    expect(asiento.lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: 'BTC', monto: '1' });
  });
});

describe('transferirEntreCompartimentos mueve disponible entre compartimentos (mismo user)', () => {
  test('funding→spot: funding:disponible −A, spot:disponible +A', async () => {
    await transferirEntreCompartimentos({
      userId: 'u', criptomonedaId: 'BTC', cantidad: '2',
      origen: 'funding', destino: 'spot', referencia: 'transfer:1',
    }, 'tx');

    expect(postTransaction).toHaveBeenCalledTimes(1);
    const [asiento, transaction] = postTransaction.mock.calls[0];
    expect(transaction).toBe('tx');
    expect(asiento.tipo).toBe('transferencia_compartimento');
    expect(asiento.referencia).toBe('transfer:1');
    expect(asiento.lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: 'BTC', monto: '-2' });
    expect(asiento.lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.SPOT_DISPONIBLE, criptomonedaId: 'BTC', monto: '2' });
  });

  test('spot→funding: spot:disponible −A, funding:disponible +A', async () => {
    await transferirEntreCompartimentos({
      userId: 'u', criptomonedaId: 'BTC', cantidad: '2',
      origen: 'spot', destino: 'funding', referencia: 'transfer:2',
    });
    const { lineas } = postTransaction.mock.calls[0][0];
    expect(lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.SPOT_DISPONIBLE, criptomonedaId: 'BTC', monto: '-2' });
    expect(lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: 'BTC', monto: '2' });
  });

  test('rechaza compartimentos iguales o desconocidos', async () => {
    await expect(transferirEntreCompartimentos({
      userId: 'u', criptomonedaId: 'BTC', cantidad: '1', origen: 'spot', destino: 'spot', referencia: 'x',
    })).rejects.toThrow(/compartimento/i);
    await expect(transferirEntreCompartimentos({
      userId: 'u', criptomonedaId: 'BTC', cantidad: '1', origen: 'funding', destino: 'earn', referencia: 'x',
    })).rejects.toThrow(/compartimento/i);
    expect(postTransaction).not.toHaveBeenCalled();
  });
});

describe('reservarParaOrden / liberarReserva mueven disponible↔bloqueado en Spot', () => {
  test('reservarParaOrden: spot:disponible −A → spot:bloqueado +A', async () => {
    await reservarParaOrden({ userId: 'u', criptomonedaId: 'USDT', cantidad: '100', referencia: 'reserva:1' }, 'tx');
    const [asiento, transaction] = postTransaction.mock.calls[0];
    expect(transaction).toBe('tx');
    expect(asiento.tipo).toBe('reserva_orden');
    expect(asiento.referencia).toBe('reserva:1');
    expect(asiento.lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.SPOT_DISPONIBLE, criptomonedaId: 'USDT', monto: '-100' });
    expect(asiento.lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.SPOT_BLOQUEADO, criptomonedaId: 'USDT', monto: '100' });
  });

  test('liberarReserva: spot:bloqueado −A → spot:disponible +A', async () => {
    await liberarReserva({ userId: 'u', criptomonedaId: 'USDT', cantidad: '100', referencia: 'liberacion:1' });
    const asiento = postTransaction.mock.calls[0][0];
    expect(asiento.tipo).toBe('liberacion_reserva');
    expect(asiento.lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.SPOT_BLOQUEADO, criptomonedaId: 'USDT', monto: '-100' });
    expect(asiento.lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.SPOT_DISPONIBLE, criptomonedaId: 'USDT', monto: '100' });
  });
});
