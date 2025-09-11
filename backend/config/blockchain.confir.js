// config/blockchain.config.js
const dotenv = require('dotenv');
dotenv.config();

class BlockchainConfig {
  constructor() {
    this.validateConfig();
  }

  validateConfig() {
    const requiredVars = [
      'ETHEREUM_RPC_URL',
      'ETH_PRIVATE_KEY',
      'BSC_RPC_URL',
      'BNB_PRIVATE_KEY',
      'JWT_SECRET'
    ];

    const missing = requiredVars.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.warn(`⚠️ Variables de entorno faltantes: ${missing.join(', ')}`);
      console.warn('⚠️ Algunas funcionalidades pueden no estar disponibles');
    }
  }

  getNetworkConfig(network) {
    const configs = {
      ethereum: {
        rpcUrl: process.env.ETHEREUM_RPC_URL,
        privateKey: process.env.ETH_PRIVATE_KEY,
        requiredConfirmations: parseInt(process.env.ETH_REQUIRED_CONFIRMATIONS) || 12,
        gasLimit: parseInt(process.env.ETH_DEFAULT_GAS_LIMIT) || 21000,
        gasPrice: process.env.ETH_DEFAULT_GAS_PRICE || '20000000000'
      },
      bsc: {
        rpcUrl: process.env.BSC_RPC_URL,
        privateKey: process.env.BNB_PRIVATE_KEY,
        requiredConfirmations: parseInt(process.env.BSC_REQUIRED_CONFIRMATIONS) || 6,
        gasLimit: parseInt(process.env.BSC_DEFAULT_GAS_LIMIT) || 21000,
        gasPrice: process.env.BSC_DEFAULT_GAS_PRICE || '10000000000'
      },
      bitcoin: {
        rpcUrl: process.env.BITCOIN_RPC_URL || 'https://blockstream.info/testnet/api',
        privateKey: process.env.BTC_PRIVATE_KEY,
        requiredConfirmations: parseInt(process.env.BTC_REQUIRED_CONFIRMATIONS) || 6
      }
    };

    return configs[network.toLowerCase()];
  }

  getJobConfig() {
    return {
      depositScanInterval: parseInt(process.env.DEPOSIT_SCAN_INTERVAL_MS) || 60000,
      confirmationUpdateInterval: parseInt(process.env.CONFIRMATION_UPDATE_INTERVAL_MS) || 30000,
      withdrawalProcessInterval: parseInt(process.env.WITHDRAWAL_PROCESS_INTERVAL_MS) || 120000,
      healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) * 60000 || 600000
    };
  }

  getSecurityConfig() {
    return {
      maxPendingWithdrawalsPerUser: parseInt(process.env.MAX_PENDING_WITHDRAWALS_PER_USER) || 5,
      minWithdrawalAmountUsd: parseFloat(process.env.MIN_WITHDRAWAL_AMOUNT_USD) || 5,
      maxBlockchainRetries: parseInt(process.env.MAX_BLOCKCHAIN_RETRIES) || 3,
      blockchainRetryDelay: parseInt(process.env.BLOCKCHAIN_RETRY_DELAY_MS) || 5000
    };
  }

  getRateLimitConfig() {
    return {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
      withdrawalMax: parseInt(process.env.RATE_LIMIT_WITHDRAWAL_MAX) || 10,
      adminMax: parseInt(process.env.RATE_LIMIT_ADMIN_MAX) || 200,
      systemMax: parseInt(process.env.RATE_LIMIT_SYSTEM_MAX) || 20,
      scanMax: parseInt(process.env.RATE_LIMIT_SCAN_MAX) || 5
    };
  }

  isProductionMode() {
    return process.env.NODE_ENV === 'production';
  }

  isDevelopmentMode() {
    return process.env.NODE_ENV === 'development';
  }

  isTestMode() {
    return process.env.NODE_ENV === 'test';
  }
}

module.exports = new BlockchainConfig();