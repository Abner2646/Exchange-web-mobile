// Fase 3: NetworkProfile para las chains EVM (Ethereum, BSC). Más simple que BTC
// —la address EVM no depende de la red, sólo cambian chainId/RPC/explorer/confirm—
// así que acá NO hay valores de derivación en juego. El perfil centraliza la
// identidad de red (chainId, nombre, confirmaciones) y NOMBRA las env keys de los
// secretos (RPC url, private key), que siguen viviendo en env (disciplina Fase 5.0:
// secretos y config por-ambiente en env, política de negocio/identidad en código).
const { ethereumNetworkProfile, bscNetworkProfile } = require('../config/networks/evm');

describe('EVM network profiles', () => {
  test('ethereum: mainnet vs sepolia (chainId + nombre)', () => {
    expect(ethereumNetworkProfile('mainnet')).toMatchObject({ actualNetwork: 'ethereum', chainId: 1, env: 'mainnet' });
    expect(ethereumNetworkProfile('testnet')).toMatchObject({ actualNetwork: 'sepolia', chainId: 11155111, env: 'testnet' });
  });

  test('bsc: mainnet vs testnet (chainId + nombre)', () => {
    expect(bscNetworkProfile('mainnet')).toMatchObject({ actualNetwork: 'bsc', chainId: 56, env: 'mainnet' });
    expect(bscNetworkProfile('testnet')).toMatchObject({ actualNetwork: 'bsc-testnet', chainId: 97, env: 'testnet' });
  });

  test('el perfil NOMBRA las env keys de los secretos, no los valores', () => {
    expect(ethereumNetworkProfile('testnet').rpcUrlEnv).toBe('ETHEREUM_SEPOLIA_RPC_URL');
    expect(ethereumNetworkProfile('testnet').privateKeyEnv).toBe('ETH_SEPOLIA_PRIVATE_KEY');
    expect(bscNetworkProfile('mainnet').rpcUrlEnv).toBe('BSC_RPC_URL');
    expect(bscNetworkProfile('mainnet').privateKeyEnv).toBe('BNB_PRIVATE_KEY');
  });

  test('selección por default preserva la lógica isTestnet previa (NODE_ENV=test → testnet)', () => {
    // ETH: isTestnet = NODE_ENV !== 'production'
    expect(ethereumNetworkProfile().env).toBe('testnet');
    // BSC: isTestnet = BSC_NETWORK === 'testnet' || NODE_ENV !== 'production'
    expect(bscNetworkProfile().env).toBe('testnet');
  });
});
