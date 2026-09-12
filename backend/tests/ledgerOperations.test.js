// tests/ledgerOperations.test.js
//
// Unit del asiento de swap (modules/balances/ledger/operations.js settleSwap): fija la
// PARTIDA DOBLE exacta (qué cuenta, qué signo, qué cripto) sin tocar la DB —
// postTransaction se mockea. Es la contraparte unit del test de integración del
// swap: acá se cazan errores de signo/cuenta en la construcción de las líneas.

jest.mock('../modules/balances/ledger/postingService', () => ({ postTransaction: jest.fn() }));

const { postTransaction } = require('../modules/balances/ledger/postingService');
const { PURPOSES } = require('../modules/balances/ledger/ledgerAccounts');
const {
  settleSwap, settleTrade, markWithdrawalTransmitted,
  registerPendingDeposit, confirmDeposit, transferInternal, settleP2P,
  creditFaucet, transferBetweenCompartments, reserveForOrder, releaseReservation,
} = require('../modules/balances/ledger/operations');

beforeEach(() => jest.clearAllMocks());

describe('settleSwap arma el asiento del swap (net-zero por cripto)', () => {
  test('compra: paga requiredQuote en quote, recibe base; treasury + fee_revenue', async () => {
    await settleSwap({
      userId: 'u', baseCryptoId: 'BTC', quoteCryptoId: 'USDT',
      baseAmount: '3', quoteAmount: '0.3', feeAmount: '0.003',
      requiredQuote: '0.303', netQuote: '0.297', type: 'buy', referencia: 'swap:1',
    }, 'tx');

    expect(postTransaction).toHaveBeenCalledTimes(1);
    const [asiento, transaction] = postTransaction.mock.calls[0];
    expect(transaction).toBe('tx');
    expect(asiento.type).toBe('swap');
    expect(asiento.reference).toBe('swap:1');
    expect(asiento.description).toBe('Swap buy');
    expect(asiento.lines).toContainEqual({ ownerId: 'u', purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: 'USDT', amount: '-0.303' });
    expect(asiento.lines).toContainEqual({ ownerId: null, purpose: PURPOSES.TREASURY, cryptoId: 'USDT', amount: '0.3' });
    expect(asiento.lines).toContainEqual({ ownerId: null, purpose: PURPOSES.FEE_REVENUE, cryptoId: 'USDT', amount: '0.003' });
    expect(asiento.lines).toContainEqual({ ownerId: null, purpose: PURPOSES.TREASURY, cryptoId: 'BTC', amount: '-3' });
    expect(asiento.lines).toContainEqual({ ownerId: 'u', purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: 'BTC', amount: '3' });
  });

  test('venta: paga base, recibe netQuote en quote; treasury + fee_revenue', async () => {
    await settleSwap({
      userId: 'u', baseCryptoId: 'BTC', quoteCryptoId: 'USDT',
      baseAmount: '0.29', quoteAmount: '0.29', feeAmount: '0.0029',
      requiredQuote: '0.2929', netQuote: '0.2871', type: 'sell', referencia: 'swap:2',
    }, 'tx');

    const asiento = postTransaction.mock.calls[0][0];
    expect(asiento.description).toBe('Swap sell');
    const { lines } = asiento;
    expect(lines).toContainEqual({ ownerId: 'u', purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: 'BTC', amount: '-0.29' });
    expect(lines).toContainEqual({ ownerId: null, purpose: PURPOSES.TREASURY, cryptoId: 'BTC', amount: '0.29' });
    expect(lines).toContainEqual({ ownerId: null, purpose: PURPOSES.TREASURY, cryptoId: 'USDT', amount: '-0.29' });
    expect(lines).toContainEqual({ ownerId: 'u', purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: 'USDT', amount: '0.2871' });
    expect(lines).toContainEqual({ ownerId: null, purpose: PURPOSES.FEE_REVENUE, cryptoId: 'USDT', amount: '0.0029' });
  });
});

describe('settleTrade arma el asiento del trade spot user↔user', () => {
  test('con fees: vendedor(bloqueado)→comprador(disponible) en base, y viceversa en quote; fee_revenue por lado', async () => {
    await settleTrade({
      buyerId: 'comprador', sellerId: 'vendedor', baseAssetId: 'BTC', quoteAssetId: 'USDT',
      quantity: '1', quoteAmount: '100', buyerFee: '0.001', sellerFee: '0.1', referencia: 'trade:1',
    }, 'tx');

    const [asiento, transaction] = postTransaction.mock.calls[0];
    expect(transaction).toBe('tx');
    expect(asiento.type).toBe('liquidacion_trade');
    expect(asiento.reference).toBe('trade:1');
    expect(asiento.description).toBe('Trade spot');
    // BASE: el vendedor libera bloqueado, el comprador recibe neto, la casa cobra el fee taker.
    expect(asiento.lines).toContainEqual({ ownerId: 'vendedor', purpose: PURPOSES.SPOT_BLOCKED, cryptoId: 'BTC', amount: '-1' });
    expect(asiento.lines).toContainEqual({ ownerId: 'comprador', purpose: PURPOSES.SPOT_AVAILABLE, cryptoId: 'BTC', amount: '0.999' });
    expect(asiento.lines).toContainEqual({ ownerId: null, purpose: PURPOSES.FEE_REVENUE, cryptoId: 'BTC', amount: '0.001' });
    // QUOTE: el comprador libera bloqueado, el vendedor recibe neto, la casa cobra el fee maker.
    expect(asiento.lines).toContainEqual({ ownerId: 'comprador', purpose: PURPOSES.SPOT_BLOCKED, cryptoId: 'USDT', amount: '-100' });
    expect(asiento.lines).toContainEqual({ ownerId: 'vendedor', purpose: PURPOSES.SPOT_AVAILABLE, cryptoId: 'USDT', amount: '99.9' });
    expect(asiento.lines).toContainEqual({ ownerId: null, purpose: PURPOSES.FEE_REVENUE, cryptoId: 'USDT', amount: '0.1' });
  });

  test('sin fees: no emite líneas de fee_revenue (sólo las 4 patas de usuario)', async () => {
    await settleTrade({
      buyerId: 'comprador', sellerId: 'vendedor', baseAssetId: 'BTC', quoteAssetId: 'USDT',
      quantity: '1', quoteAmount: '100', buyerFee: '0', sellerFee: '0', referencia: 'trade:2',
    });

    const { lines } = postTransaction.mock.calls[0][0];
    expect(lines).toHaveLength(4);
    expect(lines.some((l) => l.purpose === PURPOSES.FEE_REVENUE)).toBe(false);
  });
});

describe('markWithdrawalTransmitted arma el asiento del retiro on-chain', () => {
  test('sin fee: funding:bloqueado −A → external_onchain +A (2 líneas)', async () => {
    await markWithdrawalTransmitted({
      userId: 'u', criptomonedaId: 'BTC', cantidad: '1', referencia: 'retiro:1',
    }, 'tx');

    const [asiento, transaction] = postTransaction.mock.calls[0];
    expect(transaction).toBe('tx');
    expect(asiento.type).toBe('retiro');
    expect(asiento.description).toBe('Retiro transmitido on-chain');
    expect(asiento.lines).toHaveLength(2);
    expect(asiento.lines).toContainEqual({ ownerId: 'u', purpose: PURPOSES.FUNDING_BLOCKED, cryptoId: 'BTC', amount: '-1' });
    expect(asiento.lines).toContainEqual({ ownerId: null, purpose: PURPOSES.EXTERNAL_ONCHAIN, cryptoId: 'BTC', amount: '1' });
  });

  test('con fee de retiro: external_onchain +(A−wf) y fee_revenue +wf', async () => {
    await markWithdrawalTransmitted({
      userId: 'u', criptomonedaId: 'BTC', cantidad: '1', feeRetiro: '0.1', referencia: 'retiro:2',
    });

    const { lines } = postTransaction.mock.calls[0][0];
    expect(lines).toContainEqual({ ownerId: 'u', purpose: PURPOSES.FUNDING_BLOCKED, cryptoId: 'BTC', amount: '-1' });
    expect(lines).toContainEqual({ ownerId: null, purpose: PURPOSES.EXTERNAL_ONCHAIN, cryptoId: 'BTC', amount: '0.9' });
    expect(lines).toContainEqual({ ownerId: null, purpose: PURPOSES.FEE_REVENUE, cryptoId: 'BTC', amount: '0.1' });
  });
});

describe('registerPendingDeposit / confirmDeposit arman los asientos del depósito', () => {
  test('detección: external_onchain −A → funding:pendiente +A', async () => {
    await registerPendingDeposit({ userId: 'u', criptomonedaId: 'BTC', cantidad: '1.5', referencia: 'dep-pend:1' }, 'tx');

    const [asiento, transaction] = postTransaction.mock.calls[0];
    expect(transaction).toBe('tx');
    expect(asiento.type).toBe('deposito');
    expect(asiento.description).toBe('Depósito detectado (pendiente)');
    expect(asiento.lines).toContainEqual({ ownerId: null, purpose: PURPOSES.EXTERNAL_ONCHAIN, cryptoId: 'BTC', amount: '-1.5' });
    expect(asiento.lines).toContainEqual({ ownerId: 'u', purpose: PURPOSES.FUNDING_PENDING, cryptoId: 'BTC', amount: '1.5' });
  });

  test('confirmación: funding:pendiente −A → funding:disponible +A', async () => {
    await confirmDeposit({ userId: 'u', criptomonedaId: 'BTC', cantidad: '1.5', referencia: 'dep-conf:1' });

    const asiento = postTransaction.mock.calls[0][0];
    expect(asiento.type).toBe('deposito');
    expect(asiento.description).toBe('Depósito confirmado');
    const { lines } = asiento;
    expect(lines).toContainEqual({ ownerId: 'u', purpose: PURPOSES.FUNDING_PENDING, cryptoId: 'BTC', amount: '-1.5' });
    expect(lines).toContainEqual({ ownerId: 'u', purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: 'BTC', amount: '1.5' });
  });
});

describe('transferInternal arma el asiento de la transferencia user↔user', () => {
  test('remitente disponible −A → destinatario disponible +A (sin suspense)', async () => {
    await transferInternal({
      remitenteId: 'from', destinatarioId: 'to', criptomonedaId: 'BTC', cantidad: '50', referencia: 'transferencia:1',
    }, 'tx');

    const [asiento, transaction] = postTransaction.mock.calls[0];
    expect(transaction).toBe('tx');
    expect(asiento.type).toBe('transferencia');
    expect(asiento.description).toBe('Transferencia interna');
    expect(asiento.lines).toHaveLength(2);
    expect(asiento.lines).toContainEqual({ ownerId: 'from', purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: 'BTC', amount: '-50' });
    expect(asiento.lines).toContainEqual({ ownerId: 'to', purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: 'BTC', amount: '50' });
  });
});

describe('settleP2P arma el asiento de la transacción P2P', () => {
  test('cripto bloqueado del vendedor → disponible del comprador (sin suspense)', async () => {
    await settleP2P({
      sellerId: 'v', buyerId: 'c', cryptoId: 'BTC', amount: '0.5', referencia: 'p2p:1',
    }, 'tx');

    const [asiento, transaction] = postTransaction.mock.calls[0];
    expect(transaction).toBe('tx');
    expect(asiento.type).toBe('liquidacion_p2p');
    expect(asiento.description).toBe('Liquidación P2P');
    expect(asiento.lines).toHaveLength(2);
    expect(asiento.lines).toContainEqual({ ownerId: 'v', purpose: PURPOSES.FUNDING_BLOCKED, cryptoId: 'BTC', amount: '-0.5' });
    expect(asiento.lines).toContainEqual({ ownerId: 'c', purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: 'BTC', amount: '0.5' });
  });
});

describe('creditFaucet arma el asiento del faucet de testnet', () => {
  test('external_onchain −A → funding:disponible +A (sin suspense)', async () => {
    await creditFaucet({ userId: 'u', criptomonedaId: 'BTC', cantidad: '1', referencia: 'faucet:1' }, 'tx');

    const [asiento, transaction] = postTransaction.mock.calls[0];
    expect(transaction).toBe('tx');
    expect(asiento.type).toBe('deposito');
    expect(asiento.description).toBe('Faucet testnet');
    expect(asiento.lines).toHaveLength(2);
    expect(asiento.lines).toContainEqual({ ownerId: null, purpose: PURPOSES.EXTERNAL_ONCHAIN, cryptoId: 'BTC', amount: '-1' });
    expect(asiento.lines).toContainEqual({ ownerId: 'u', purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: 'BTC', amount: '1' });
  });
});

describe('transferBetweenCompartments mueve disponible entre compartimentos (mismo user)', () => {
  test('funding→spot: funding:disponible −A, spot:disponible +A', async () => {
    await transferBetweenCompartments({
      userId: 'u', criptomonedaId: 'BTC', cantidad: '2',
      origen: 'funding', destino: 'spot', referencia: 'transfer:1',
    }, 'tx');

    expect(postTransaction).toHaveBeenCalledTimes(1);
    const [asiento, transaction] = postTransaction.mock.calls[0];
    expect(transaction).toBe('tx');
    expect(asiento.type).toBe('transferencia_compartimento');
    expect(asiento.reference).toBe('transfer:1');
    expect(asiento.lines).toContainEqual({ ownerId: 'u', purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: 'BTC', amount: '-2' });
    expect(asiento.lines).toContainEqual({ ownerId: 'u', purpose: PURPOSES.SPOT_AVAILABLE, cryptoId: 'BTC', amount: '2' });
  });

  test('spot→funding: spot:disponible −A, funding:disponible +A', async () => {
    await transferBetweenCompartments({
      userId: 'u', criptomonedaId: 'BTC', cantidad: '2',
      origen: 'spot', destino: 'funding', referencia: 'transfer:2',
    });
    const { lines } = postTransaction.mock.calls[0][0];
    expect(lines).toContainEqual({ ownerId: 'u', purpose: PURPOSES.SPOT_AVAILABLE, cryptoId: 'BTC', amount: '-2' });
    expect(lines).toContainEqual({ ownerId: 'u', purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: 'BTC', amount: '2' });
  });

  test('rechaza compartimentos iguales o desconocidos', async () => {
    await expect(transferBetweenCompartments({
      userId: 'u', criptomonedaId: 'BTC', cantidad: '1', origen: 'spot', destino: 'spot', referencia: 'x',
    })).rejects.toThrow(/compartimento/i);
    await expect(transferBetweenCompartments({
      userId: 'u', criptomonedaId: 'BTC', cantidad: '1', origen: 'funding', destino: 'earn', referencia: 'x',
    })).rejects.toThrow(/compartimento/i);
    expect(postTransaction).not.toHaveBeenCalled();
  });
});

describe('reserveForOrder / releaseReservation mueven disponible↔bloqueado en Spot', () => {
  test('reserveForOrder: spot:disponible −A → spot:bloqueado +A', async () => {
    await reserveForOrder({ userId: 'u', cryptoId: 'USDT', quantity: '100', referencia: 'reserva:1' }, 'tx');
    const [asiento, transaction] = postTransaction.mock.calls[0];
    expect(transaction).toBe('tx');
    expect(asiento.type).toBe('reserva_orden');
    expect(asiento.reference).toBe('reserva:1');
    expect(asiento.lines).toContainEqual({ ownerId: 'u', purpose: PURPOSES.SPOT_AVAILABLE, cryptoId: 'USDT', amount: '-100' });
    expect(asiento.lines).toContainEqual({ ownerId: 'u', purpose: PURPOSES.SPOT_BLOCKED, cryptoId: 'USDT', amount: '100' });
  });

  test('releaseReservation: spot:bloqueado −A → spot:disponible +A', async () => {
    await releaseReservation({ userId: 'u', cryptoId: 'USDT', quantity: '100', referencia: 'liberacion:1' });
    const asiento = postTransaction.mock.calls[0][0];
    expect(asiento.type).toBe('liberacion_reserva');
    expect(asiento.lines).toContainEqual({ ownerId: 'u', purpose: PURPOSES.SPOT_BLOCKED, cryptoId: 'USDT', amount: '-100' });
    expect(asiento.lines).toContainEqual({ ownerId: 'u', purpose: PURPOSES.SPOT_AVAILABLE, cryptoId: 'USDT', amount: '100' });
  });
});

describe('settleSwap respeta el compartimento origen', () => {
  test("compartimento 'spot': las patas del usuario van a spot:disponible", async () => {
    await settleSwap({
      userId: 'u', baseCryptoId: 'BTC', quoteCryptoId: 'USDT',
      baseAmount: '3', quoteAmount: '0.3', feeAmount: '0.003',
      requiredQuote: '0.303', netQuote: '0.297', type: 'buy',
      compartimento: 'spot', referencia: 'swap:spot:1',
    });
    const { lines } = postTransaction.mock.calls[0][0];
    // patas del usuario en Spot…
    expect(lines).toContainEqual({ ownerId: 'u', purpose: PURPOSES.SPOT_AVAILABLE, cryptoId: 'USDT', amount: '-0.303' });
    expect(lines).toContainEqual({ ownerId: 'u', purpose: PURPOSES.SPOT_AVAILABLE, cryptoId: 'BTC', amount: '3' });
    // …y ninguna pata de usuario en Funding.
    expect(lines.some((l) => l.purpose === PURPOSES.FUNDING_AVAILABLE)).toBe(false);
    // casa intacta.
    expect(lines).toContainEqual({ ownerId: null, purpose: PURPOSES.FEE_REVENUE, cryptoId: 'USDT', amount: '0.003' });
  });

  test('sin compartimento explícito, default = funding (comportamiento actual)', async () => {
    await settleSwap({
      userId: 'u', baseCryptoId: 'BTC', quoteCryptoId: 'USDT',
      baseAmount: '3', quoteAmount: '0.3', feeAmount: '0.003',
      requiredQuote: '0.303', netQuote: '0.297', type: 'buy', referencia: 'swap:def:1',
    });
    const { lines } = postTransaction.mock.calls[0][0];
    expect(lines).toContainEqual({ ownerId: 'u', purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: 'BTC', amount: '3' });
  });

  test('compartimento desconocido → error, sin postear', async () => {
    await expect(settleSwap({
      userId: 'u', baseCryptoId: 'BTC', quoteCryptoId: 'USDT',
      baseAmount: '3', quoteAmount: '0.3', feeAmount: '0.003',
      requiredQuote: '0.303', netQuote: '0.297', type: 'buy',
      compartimento: 'earn', referencia: 'swap:bad:1',
    })).rejects.toThrow(/compartimento/i);
    expect(postTransaction).not.toHaveBeenCalled();
  });
});
