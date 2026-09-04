// config/networks/evm.js
//
// Fase 3 — NetworkProfile para las chains EVM (Ethereum, BSC). A diferencia de
// Bitcoin, la address EVM NO depende de la red (una private key da la misma
// address en cualquier chain EVM) → acá no hay valores de derivación en juego;
// lo único que cambia entre entornos es chainId, el RPC, el explorador y las
// confirmaciones. El perfil es la única fuente de esa identidad de red, en vez de
// que cada service lea `isTestnet`/`NODE_ENV` y arme chainId/nombre por su cuenta.
//
// Los SECRETOS (rpc url, private key) siguen en env — el perfil sólo NOMBRA qué
// env key usar por (chain, entorno) (disciplina Fase 5.0: secretos y config de
// infra por-ambiente van en env; la identidad de red va en código).

const ETHEREUM = {
  mainnet: {
    chain: 'ethereum', env: 'mainnet', actualNetwork: 'ethereum', chainId: 1,
    requiredConfirmations: 12, rpcUrlEnv: 'ETHEREUM_RPC_URL', privateKeyEnv: 'ETH_PRIVATE_KEY',
  },
  testnet: {
    chain: 'ethereum', env: 'testnet', actualNetwork: 'sepolia', chainId: 11155111,
    requiredConfirmations: 12, rpcUrlEnv: 'ETHEREUM_SEPOLIA_RPC_URL', privateKeyEnv: 'ETH_SEPOLIA_PRIVATE_KEY',
  },
};

const BSC = {
  mainnet: {
    chain: 'bsc', env: 'mainnet', actualNetwork: 'bsc', chainId: 56,
    requiredConfirmations: 6, rpcUrlEnv: 'BSC_RPC_URL', privateKeyEnv: 'BNB_PRIVATE_KEY',
  },
  testnet: {
    chain: 'bsc', env: 'testnet', actualNetwork: 'bsc-testnet', chainId: 97,
    requiredConfirmations: 6, rpcUrlEnv: 'BSC_TESTNET_RPC_URL', privateKeyEnv: 'BNB_TESTNET_PRIVATE_KEY',
  },
};

// Ethereum: testnet salvo en producción (preserva `isTestnet = NODE_ENV !== 'production'`).
function ethereumNetworkProfile(env) {
  const resolved = env || (process.env.NODE_ENV !== 'production' ? 'testnet' : 'mainnet');
  return resolved === 'mainnet' ? ETHEREUM.mainnet : ETHEREUM.testnet;
}

// BSC: testnet si BSC_NETWORK==='testnet' o si no es producción (preserva la lógica
// previa `isTestnet = BSC_NETWORK === 'testnet' || NODE_ENV !== 'production'`).
function bscNetworkProfile(env) {
  const resolved = env
    || ((process.env.BSC_NETWORK === 'testnet' || process.env.NODE_ENV !== 'production') ? 'testnet' : 'mainnet');
  return resolved === 'mainnet' ? BSC.mainnet : BSC.testnet;
}

module.exports = {
  ethereumNetworkProfile, bscNetworkProfile,
  ETHEREUM_PROFILES: ETHEREUM, BSC_PROFILES: BSC,
};
