// tests/hdAddressGeneration.test.js
//
// Covers AUDITORIA_BACKEND.md Críticos #1: la generación de direcciones de
// depósito ETH/BSC tiene que ser derivación HD real (BIP32 + Keccak), no un
// hash disfrazado de dirección. Este test no necesita una base de datos real
// porque _generateEthereumAddress es una función pura sobre sus argumentos.

const { Sequelize } = require('sequelize');
const bip39 = require('bip39');
const { BIP32Factory } = require('bip32');
const ecc = require('tiny-secp256k1');
const { ethers } = require('ethers');

const bip32 = BIP32Factory(ecc);
const createDireccionDepositoModel = require('../models/direccionDeposito.model');
const { WalletSetupGenerator } = require('../controllers/setupWallets.controller');

// Sequelize nunca llega a conectar: Model.init() no requiere una conexión real,
// solo un dialecto válido.
const sequelize = new Sequelize('postgres://test:test@localhost:5432/test', {
  dialect: 'postgres',
  logging: false,
});

const DireccionDeposito = createDireccionDepositoModel(sequelize);

function xpubDeCuentaDePrueba() {
  const mnemonic = bip39.generateMnemonic();
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed);
  const account = root.derivePath("m/44'/60'/0'");
  return account.neutered().toBase58();
}

describe('DireccionDeposito._generateEthereumAddress', () => {
  const xpub = xpubDeCuentaDePrueba();

  test('genera una dirección Ethereum válida y checksummeada', () => {
    const { address } = DireccionDeposito._generateEthereumAddress(xpub, "m/44'/60'/0'", 0, 1);
    expect(ethers.isAddress(address)).toBe(true);
    expect(address).toBe(ethers.getAddress(address)); // checksum correcto
  });

  test('es determinística: mismo xpub + mismo índice = misma dirección siempre', () => {
    const primera = DireccionDeposito._generateEthereumAddress(xpub, "m/44'/60'/0'", 3, 1);
    const segunda = DireccionDeposito._generateEthereumAddress(xpub, "m/44'/60'/0'", 3, 1);
    expect(primera.address).toBe(segunda.address);
  });

  test('cada índice de derivación produce una dirección distinta', () => {
    const direcciones = new Set(
      [0, 1, 2, 3, 4].map(
        (index) => DireccionDeposito._generateEthereumAddress(xpub, "m/44'/60'/0'", index, 1).address
      )
    );
    expect(direcciones.size).toBe(5);
  });

  test('dos xpubs distintos producen direcciones distintas para el mismo índice', () => {
    const otroXpub = xpubDeCuentaDePrueba();
    const a = DireccionDeposito._generateEthereumAddress(xpub, "m/44'/60'/0'", 0, 1);
    const b = DireccionDeposito._generateEthereumAddress(otroXpub, "m/44'/60'/0'", 0, 1);
    expect(a.address).not.toBe(b.address);
  });
});

describe('WalletSetupGenerator.generateBNBWallet', () => {
  test('la address devuelta corresponde de verdad a la private key recibida', async () => {
    const privateKey = '0x' + '7'.repeat(64);
    const { address } = await WalletSetupGenerator.generateBNBWallet(privateKey);
    expect(address.toLowerCase()).toBe(new ethers.Wallet(privateKey).address.toLowerCase());
  });

  test('el xpub devuelto es un extended public key BIP32 válido y usable', async () => {
    const privateKey = '0x' + '9'.repeat(64);
    const { xpub } = await WalletSetupGenerator.generateBNBWallet(privateKey);
    // Si no fuera un xpub real, fromBase58 tira una excepción acá.
    expect(() => bip32.fromBase58(xpub)).not.toThrow();
  });
});
