// tests/btcDerivationPath.test.js
//
// Cubre AUDITORIA_BACKEND.md Altos #8: la wallet maestra de BTC guardaba
// config.derivationPath (BIP84, "m/84'/1'/0'", de CRIPTOMONEDAS_BASICAS)
// en vez de walletData.derivationPath (BIP44, lo que getBTCWalletFromEnv
// realmente usó para derivar fingerprint/publicKey) — el metadato
// persistido no coincidía con la derivación real.

const bip39 = require('bip39');

describe('WalletSetupGenerator.getBTCWalletFromEnv', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env.BTC_MNEMONIC = bip39.generateMnemonic();
    process.env.BTC_PRIVATE_KEY = 'a'.repeat(64);
    process.env.BITCOIN_WALLET_ADDRESS = 'm' + 'A'.repeat(33); // formato testnet legacy
    process.env.BTC_MASTER_XPUB = 'tpubFAKEFORTESTS123456789';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('el derivationPath devuelto es el que realmente se usó para derivar (BIP44), no BIP84', () => {
    const { WalletSetupGenerator } = require('../controllers/setupWallets.controller');
    const walletData = WalletSetupGenerator.getBTCWalletFromEnv();

    // BIP44 testnet, no BIP84 (que es lo que dice CRIPTOMONEDAS_BASICAS)
    expect(walletData.derivationPath).toBe("m/44'/1'/0'");
    expect(walletData.derivationPath).not.toBe("m/84'/1'/0'");
  });

  test('re-derivar a mano con el path devuelto reproduce el mismo publicKey (el metadato es honesto)', () => {
    const { WalletSetupGenerator } = require('../controllers/setupWallets.controller');
    const bip32 = require('bip32').BIP32Factory(require('tiny-secp256k1'));
    const bitcoin = require('bitcoinjs-lib');

    const walletData = WalletSetupGenerator.getBTCWalletFromEnv();

    const seed = bip39.mnemonicToSeedSync(process.env.BTC_MNEMONIC);
    const root = bip32.fromSeed(seed, bitcoin.networks.testnet);
    const account = root.derivePath(walletData.derivationPath);

    expect(account.publicKey.toString('hex')).toBe(walletData.publicKey);
  });
});
