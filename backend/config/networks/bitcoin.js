// config/networks/bitcoin.js
//
// Fase 3 — NetworkProfile de Bitcoin: ÚNICA fuente de "qué significa testnet vs
// mainnet para BTC". Antes cada punto (bitcoin.service, setupWallets, direccion
// de depósito, blockchain.confir) leía `isTestnet`/`BITCOIN_NETWORK` por su cuenta
// y armaba el objeto de red / coin type / explorador con variaciones sutiles — la
// fuente estructural del bug BIP84-vs-BIP44 (path declarado que no coincide con el
// derivado) y del riesgo de generar una dirección de una red usando el address
// space de la otra (testnet vs mainnet NO son intercambiables: HRP tb vs bc).
//
// El perfil se inyecta por constructor en el service (no se lee env desde adentro),
// así el mismo mecanismo sirve para poner un perfil de testnet en pruebas y un
// provider fake en tests automáticos (se engancha con la Fase 2).
//
// Los VALORES son exactamente los que el código usaba antes de esta centralización
// (refactor que preserva comportamiento). La corrección de la inconsistencia
// BIP84-vs-BIP44 de la derivación es un paso aparte (toca valores de derivación).
const bitcoin = require('bitcoinjs-lib');

const PROFILES = {
  mainnet: {
    chain: 'bitcoin',
    env: 'mainnet',
    networkName: 'mainnet',
    bitcoinjsNetwork: bitcoin.networks.bitcoin,
    bip44CoinType: 0, // m/44'/0' (o 84') — mainnet
    explorerBaseUrl: 'https://api.blockcypher.com/v1/btc/main',
    minConfirmations: 3,
  },
  testnet: {
    chain: 'bitcoin',
    env: 'testnet',
    networkName: 'testnet3',
    bitcoinjsNetwork: bitcoin.networks.testnet,
    bip44CoinType: 1, // m/44'/1' (o 84') — todas las testnets
    explorerBaseUrl: 'https://api.blockcypher.com/v1/btc/test3',
    minConfirmations: 3,
  },
};

// Selección por nombre de red. Preserva la lógica previa exactamente: sólo
// 'mainnet' selecciona mainnet; cualquier otra cosa (incluido el default
// 'testnet3' y valores desconocidos) cae en testnet — es la política segura para
// una red de fondos (nunca elegir mainnet por accidente).
function bitcoinNetworkProfile(networkName = process.env.BITCOIN_NETWORK || 'testnet3') {
  return networkName === 'mainnet' ? PROFILES.mainnet : PROFILES.testnet;
}

module.exports = { bitcoinNetworkProfile, BITCOIN_PROFILES: PROFILES };
