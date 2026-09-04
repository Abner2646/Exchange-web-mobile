// tests/bitcoinService.test.js
//
// Fase 1 — precisión monetaria en retiros/depósitos on-chain. El punto más
// peligroso era la conversión BTC->satoshis del retiro: `Math.floor(parseFloat(
// cantidad) * 1e8)`. En float binario, 0.29 * 1e8 = 28999999.999999996 y el
// Math.floor lo deja en 28999999 — se transmite 1 satoshi de MENOS on-chain.
// La columna cantidad es DECIMAL(28,8), así que cantidad*1e8 siempre es un
// entero exacto: con money.js (decimal.js) la conversión es exacta.

jest.mock('../models', () => ({
  TransaccionBlockchain: { createDeposit: jest.fn() },
  DireccionDeposito: {},
  Criptomoneda: {},
  BlockchainState: {},
}));

const { TransaccionBlockchain } = require('../models');
const BitcoinService = require('../services/blockchain/bitcoin.service');
const bitcoin = require('bitcoinjs-lib');
const { BITCOIN_PROFILES } = require('../config/networks/bitcoin');

const svc = new BitcoinService();

// Fase 3: el service consume el NetworkProfile INYECTADO (red, explorador,
// confirmaciones) en vez de leer env desde adentro — mismo mecanismo que permite
// aislar testnet/mainnet en tests y, más adelante, inyectar un provider fake.
describe('bitcoin.service — NetworkProfile inyectado', () => {
  test('mainnet profile → red bitcoin, explorador main', () => {
    const s = new BitcoinService(BITCOIN_PROFILES.mainnet);
    expect(s.network).toBe(bitcoin.networks.bitcoin);
    expect(s.networkName).toBe('mainnet');
    expect(s.baseUrl).toContain('/btc/main');
    expect(s.requiredConfirmations).toBe(3);
  });

  test('testnet profile → red testnet, explorador test3', () => {
    const s = new BitcoinService(BITCOIN_PROFILES.testnet);
    expect(s.network).toBe(bitcoin.networks.testnet);
    expect(s.networkName).toBe('testnet3');
    expect(s.baseUrl).toContain('/btc/test3');
  });
});

describe('bitcoin.btcToSatoshis — conversión exacta a satoshis (sin perder polvo)', () => {
  test('0.29 BTC = 29000000 satoshis (float+floor daría 28999999)', () => {
    expect(svc.btcToSatoshis('0.29')).toBe(29000000);
  });

  test('montos varios: exactos al satoshi', () => {
    expect(svc.btcToSatoshis('0.1')).toBe(10000000);
    expect(svc.btcToSatoshis('0.00000001')).toBe(1);
    expect(svc.btcToSatoshis('1')).toBe(100000000);
  });
});

describe('bitcoin.createBitcoinDeposit — net amount y fee exactos', () => {
  beforeEach(() => jest.clearAllMocks());

  test('cantidad = amount - fee sin error de coma; fee como string', async () => {
    TransaccionBlockchain.createDeposit.mockResolvedValue({ id: 'dep1' });

    await svc.createBitcoinDeposit(
      { userId: 'u', criptomonedaId: 'c', direccion: 'addr' },
      '0.3', '0.1', 'txhash', 3, null, 100,
    );

    const data = TransaccionBlockchain.createDeposit.mock.calls[0][0];
    // float: 0.3 - 0.1 = 0.19999999999999998
    expect(data.cantidad).toBe('0.2');
    expect(data.feeBlockchain).toBe('0.1');
  });

  test('net amount nunca es negativo (colapsa a "0")', async () => {
    TransaccionBlockchain.createDeposit.mockResolvedValue({ id: 'dep2' });

    await svc.createBitcoinDeposit(
      { userId: 'u', criptomonedaId: 'c', direccion: 'addr' },
      '0.00001', '0.0001', 'txhash', 3, null, 100,
    );

    const data = TransaccionBlockchain.createDeposit.mock.calls[0][0];
    expect(data.cantidad).toBe('0');
  });
});
