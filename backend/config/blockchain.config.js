// config/blockchain.js
const { ethers } = require('ethers');

// Configuración de redes blockchain
const NETWORKS = {
  ethereum: {
    name: 'Ethereum Testnet (Sepolia)',
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
    chainId: 11155111,
    gasLimit: 21000,
    gasPrice: '20000000000', // 20 gwei
    confirmations: 12,
    nativeCurrency: 'ETH'
  },
  bsc: {
    name: 'BSC Testnet',
    rpcUrl: process.env.BSC_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545',
    chainId: 97,
    gasLimit: 21000,
    gasPrice: '10000000000', // 10 gwei
    confirmations: 6,
    nativeCurrency: 'BNB'
  }
};

// ABI para tokens ERC-20
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

class BlockchainConfig {
  static getProvider(network) {
    const config = NETWORKS[network.toLowerCase()];
    if (!config) {
      throw new Error(`Red no soportada: ${network}`);
    }
    return new ethers.JsonRpcProvider(config.rpcUrl);
  }

  static getWallet(network, privateKey) {
    const provider = this.getProvider(network);
    return new ethers.Wallet(privateKey, provider);
  }

  static getNetworkConfig(network) {
    return NETWORKS[network.toLowerCase()];
  }

  static getERC20Contract(contractAddress, signerOrProvider) {
    return new ethers.Contract(contractAddress, ERC20_ABI, signerOrProvider);
  }

  static getRequiredConfirmations(network) {
    const config = NETWORKS[network.toLowerCase()];
    return config ? config.confirmations : 6;
  }

  static isValidAddress(address, network) {
    try {
      // Para Ethereum y BSC, validar formato de dirección
      if (['ethereum', 'bsc'].includes(network.toLowerCase())) {
        return ethers.isAddress(address);
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  static formatBalance(balance, decimals = 18) {
    return ethers.formatUnits(balance, decimals);
  }

  static parseBalance(amount, decimals = 18) {
    return ethers.parseUnits(amount.toString(), decimals);
  }
}

module.exports = {
  BlockchainConfig,
  NETWORKS,
  ERC20_ABI
};