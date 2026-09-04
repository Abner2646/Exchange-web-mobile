// Fase 3: NetworkProfile de Bitcoin — única fuente de "qué significa testnet vs
// mainnet para BTC" (objeto de red bitcoinjs, coin type BIP44, explorador,
// confirmaciones). Antes esto estaba disperso como `isTestnet` leído de env en
// cada punto, la fuente del bug BIP84-vs-BIP44 y de direcciones cruzadas de red.
const bitcoin = require('bitcoinjs-lib');
const { bitcoinNetworkProfile } = require('../config/networks/bitcoin');

// pubkey comprimida fija (el punto generador G = pubkey de la privkey 1); derivar
// una dirección p2wpkh con la red del perfil prueba el address space sin depender
// de ECPair ni de red.
const PUBKEY = Buffer.from('0279BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798', 'hex');
const addrFor = (profile) =>
  bitcoin.payments.p2wpkh({ pubkey: PUBKEY, network: profile.bitcoinjsNetwork }).address;

describe('bitcoinNetworkProfile', () => {
  test('mainnet: red bitcoin, coin type BIP44 = 0, direcciones bc1', () => {
    const p = bitcoinNetworkProfile('mainnet');
    expect(p.env).toBe('mainnet');
    expect(p.bitcoinjsNetwork).toBe(bitcoin.networks.bitcoin);
    expect(p.bip44CoinType).toBe(0);
    expect(p.bitcoinjsNetwork.bech32).toBe('bc');
    expect(addrFor(p).startsWith('bc1')).toBe(true);
  });

  test('testnet3 (default): red testnet, coin type BIP44 = 1, direcciones tb1', () => {
    const p = bitcoinNetworkProfile('testnet3');
    expect(p.env).toBe('testnet');
    expect(p.networkName).toBe('testnet3');
    expect(p.bitcoinjsNetwork).toBe(bitcoin.networks.testnet);
    expect(p.bip44CoinType).toBe(1);
    expect(p.bitcoinjsNetwork.bech32).toBe('tb');
    expect(addrFor(p).startsWith('tb1')).toBe(true);
  });

  test('sin valor / desconocido → testnet (preserva el default previo)', () => {
    expect(bitcoinNetworkProfile(undefined).env).toBe('testnet');
    expect(bitcoinNetworkProfile('cualquier-cosa').env).toBe('testnet');
  });

  test('el perfil trae el explorador y las confirmaciones de la red', () => {
    expect(bitcoinNetworkProfile('mainnet').explorerBaseUrl).toContain('/btc/main');
    expect(bitcoinNetworkProfile('testnet3').explorerBaseUrl).toContain('/btc/test3');
    expect(bitcoinNetworkProfile('testnet3').minConfirmations).toBe(3);
  });
});
