// controllers/envChecker.controller.js

const envCheckerController = {
  // Verificar todas las variables de entorno
  checkEnvVariables: async (req, res) => {
    try {
      // Función helper para enmascarar datos sensibles
      const maskSensitive = (value) => {
        if (!value) return null;
        if (value.length > 10) {
          return value.substring(0, 6) + '...' + value.substring(value.length - 4);
        }
        return '***masked***';
      };

      // Organizar variables por categorías
      const envConfig = {
        // =================== INFORMACIÓN GENERAL ===================
        general: {
          NODE_ENV: process.env.NODE_ENV,
          PORT: process.env.PORT,
          ENABLE_CORS: process.env.ENABLE_CORS
        },

        // =================== BLOCKCHAIN BÁSICO ===================
        blockchain: {
          ETHEREUM_RPC_URL: process.env.ETHEREUM_RPC_URL,
          BSC_RPC_URL: process.env.BSC_RPC_URL,
          BITCOIN_RPC_URL: process.env.BITCOIN_RPC_URL,
          ETH_PRIVATE_KEY: maskSensitive(process.env.ETH_PRIVATE_KEY),
          BNB_PRIVATE_KEY: maskSensitive(process.env.BNB_PRIVATE_KEY),
          BTC_PRIVATE_KEY: maskSensitive(process.env.BTC_PRIVATE_KEY)
        },

        // =================== JOBS AUTOMÁTICOS ===================
        jobs: {
          DEPOSIT_SCAN_INTERVAL: process.env.DEPOSIT_SCAN_INTERVAL,
          CONFIRMATION_UPDATE_INTERVAL: process.env.CONFIRMATION_UPDATE_INTERVAL,
          WITHDRAWAL_PROCESS_INTERVAL: process.env.WITHDRAWAL_PROCESS_INTERVAL,
          CLEANUP_INTERVAL_HOURS: process.env.CLEANUP_INTERVAL_HOURS,
          HEALTH_CHECK_INTERVAL: process.env.HEALTH_CHECK_INTERVAL
        },

        // =================== CONFIRMACIONES Y GAS ===================
        networkConfig: {
          ETH_REQUIRED_CONFIRMATIONS: process.env.ETH_REQUIRED_CONFIRMATIONS,
          BSC_REQUIRED_CONFIRMATIONS: process.env.BSC_REQUIRED_CONFIRMATIONS,
          BTC_REQUIRED_CONFIRMATIONS: process.env.BTC_REQUIRED_CONFIRMATIONS,
          ETH_DEFAULT_GAS_LIMIT: process.env.ETH_DEFAULT_GAS_LIMIT,
          ETH_DEFAULT_GAS_PRICE: process.env.ETH_DEFAULT_GAS_PRICE,
          BSC_DEFAULT_GAS_LIMIT: process.env.BSC_DEFAULT_GAS_LIMIT,
          BSC_DEFAULT_GAS_PRICE: process.env.BSC_DEFAULT_GAS_PRICE
        },

        // =================== LÍMITES DE RETIRO ===================
        withdrawalLimits: {
          MIN_WITHDRAWAL_ETH: process.env.MIN_WITHDRAWAL_ETH,
          MIN_WITHDRAWAL_BNB: process.env.MIN_WITHDRAWAL_BNB,
          MIN_WITHDRAWAL_USDT: process.env.MIN_WITHDRAWAL_USDT
        },

        // =================== RATE LIMITING ===================
        rateLimiting: {
          RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
          RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
          RATE_LIMIT_WITHDRAWAL_MAX: process.env.RATE_LIMIT_WITHDRAWAL_MAX,
          RATE_LIMIT_SCAN_MAX: process.env.RATE_LIMIT_SCAN_MAX
        },

        // =================== LOGGING ===================
        logging: {
          LOG_LEVEL: process.env.LOG_LEVEL,
          LOG_TO_FILE: process.env.LOG_TO_FILE,
          LOG_FILE_PATH: process.env.LOG_FILE_PATH
        },

        // =================== SEGURIDAD ===================
        security: {
          ENCRYPTION_KEY: maskSensitive(process.env.ENCRYPTION_KEY),
          BCRYPT_SALT_ROUNDS: process.env.BCRYPT_SALT_ROUNDS,
          JWT_SECRET: maskSensitive(process.env.JWT_SECRET),
          JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN
        },

        // =================== NOTIFICACIONES ===================
        notifications: {
          ADMIN_EMAIL: process.env.ADMIN_EMAIL,
          NOTIFICATION_WEBHOOK_URL: process.env.NOTIFICATION_WEBHOOK_URL
        },

        // =================== PROVEEDORES EXTERNOS ===================
        providers: {
          INFURA_PROJECT_ID: maskSensitive(process.env.INFURA_PROJECT_ID),
          INFURA_SECRET: maskSensitive(process.env.INFURA_SECRET),
          ALCHEMY_API_KEY: maskSensitive(process.env.ALCHEMY_API_KEY),
          MORALIS_API_KEY: maskSensitive(process.env.MORALIS_API_KEY)
        },

        // =================== CACHE ===================
        cache: {
          REDIS_URL: process.env.REDIS_URL,
          REDIS_HOST: process.env.REDIS_HOST,
          REDIS_PORT: process.env.REDIS_PORT,
          REDIS_PASSWORD: maskSensitive(process.env.REDIS_PASSWORD),
          CACHE_TTL_BALANCE: process.env.CACHE_TTL_BALANCE,
          CACHE_TTL_TRANSACTION: process.env.CACHE_TTL_TRANSACTION
        },

        // =================== MONITOREO ===================
        monitoring: {
          SENTRY_DSN: maskSensitive(process.env.SENTRY_DSN),
          ENABLE_METRICS: process.env.ENABLE_METRICS,
          METRICS_PORT: process.env.METRICS_PORT
        },

        // =================== RESPALDO ===================
        backup: {
          ENABLE_BACKUP: process.env.ENABLE_BACKUP,
          BACKUP_INTERVAL_HOURS: process.env.BACKUP_INTERVAL_HOURS,
          BACKUP_PATH: process.env.BACKUP_PATH
        },

        // =================== FEES ===================
        fees: {
          EXCHANGE_FEE_PERCENTAGE: process.env.EXCHANGE_FEE_PERCENTAGE,
          ENABLE_DYNAMIC_FEES: process.env.ENABLE_DYNAMIC_FEES,
          PEAK_HOURS_FEE_MULTIPLIER: process.env.PEAK_HOURS_FEE_MULTIPLIER
        },

        // =================== WALLETS MAESTRAS ===================
        masterWallets: {
          ETH_MASTER_WALLET_ADDRESS: process.env.ETH_MASTER_WALLET_ADDRESS,
          BNB_MASTER_WALLET_ADDRESS: process.env.BNB_MASTER_WALLET_ADDRESS,
          ETH_MASTER_WALLET_MIN_BALANCE: process.env.ETH_MASTER_WALLET_MIN_BALANCE,
          BNB_MASTER_WALLET_MIN_BALANCE: process.env.BNB_MASTER_WALLET_MIN_BALANCE
        },

        // =================== TESTING ===================
        testing: {
          USE_BLOCKCHAIN_SIMULATION: process.env.USE_BLOCKCHAIN_SIMULATION,
          SIMULATE_NETWORK_DELAY: process.env.SIMULATE_NETWORK_DELAY,
          NETWORK_DELAY_MS: process.env.NETWORK_DELAY_MS
        },

        // =================== TOKENS ERC-20 ===================
        tokens: {
          USDT_CONTRACT_ADDRESS_ETH: process.env.USDT_CONTRACT_ADDRESS_ETH,
          USDC_CONTRACT_ADDRESS_ETH: process.env.USDC_CONTRACT_ADDRESS_ETH,
          USDT_DECIMALS: process.env.USDT_DECIMALS,
          USDC_DECIMALS: process.env.USDC_DECIMALS
        }
      };

      // Verificar variables críticas
      const criticalVariables = {
        missing: [],
        present: []
      };

      const criticalVars = [
        'ETHEREUM_RPC_URL',
        'BSC_RPC_URL', 
        'ETH_PRIVATE_KEY',
        'BNB_PRIVATE_KEY',
        'JWT_SECRET',
        'DB_NAME',
        'DB_USER',
        'DB_PASSWORD'
      ];

      criticalVars.forEach(varName => {
        if (process.env[varName]) {
          criticalVariables.present.push(varName);
        } else {
          criticalVariables.missing.push(varName);
        }
      });

      // Estadísticas generales
      const stats = {
        totalVariables: Object.keys(process.env).length,
        blockchainVariables: Object.keys(envConfig).reduce((total, category) => {
          return total + Object.keys(envConfig[category]).length;
        }, 0),
        criticalMissing: criticalVariables.missing.length,
        environment: process.env.NODE_ENV || 'not_set'
      };

      return res.status(200).json({
        success: true,
        message: 'Variables de entorno verificadas',
        timestamp: new Date().toISOString(),
        stats,
        criticalVariables,
        envConfig,
        notes: [
          '🔒 Datos sensibles están enmascarados por seguridad',
          '⚠️ Variables faltantes pueden causar errores en el sistema',
          '✅ Variables presentes están siendo leídas correctamente',
          '🔧 Verificar que todas las URLs sean accesibles'
        ]
      });

    } catch (error) {
      console.error('Error verificando variables de entorno:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al verificar variables de entorno',
        error: error.message
      });
    }
  },

  // Verificar conectividad de servicios
  checkConnectivity: async (req, res) => {
    try {
      const connectivityResults = {
        blockchain: {},
        database: {},
        cache: {},
        external: {}
      };

      // Test Ethereum RPC
      if (process.env.ETHEREUM_RPC_URL) {
        try {
          const { ethers } = require('ethers');
          const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
          const blockNumber = await provider.getBlockNumber();
          connectivityResults.blockchain.ethereum = {
            status: 'connected',
            latestBlock: blockNumber,
            url: process.env.ETHEREUM_RPC_URL.replace(/\/v3\/.*/, '/v3/***')
          };
        } catch (error) {
          connectivityResults.blockchain.ethereum = {
            status: 'error',
            error: error.message
          };
        }
      }

      // Test BSC RPC
      if (process.env.BSC_RPC_URL) {
        try {
          const { ethers } = require('ethers');
          const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);
          const blockNumber = await provider.getBlockNumber();
          connectivityResults.blockchain.bsc = {
            status: 'connected',
            latestBlock: blockNumber,
            url: process.env.BSC_RPC_URL
          };
        } catch (error) {
          connectivityResults.blockchain.bsc = {
            status: 'error',
            error: error.message
          };
        }
      }

      // Test Database (si está disponible)
      try {
        const { sequelize } = require('../models');
        await sequelize.authenticate();
        connectivityResults.database.postgresql = {
          status: 'connected',
          dialect: sequelize.getDialect()
        };
      } catch (error) {
        connectivityResults.database.postgresql = {
          status: 'error',
          error: error.message
        };
      }

      return res.status(200).json({
        success: true,
        message: 'Prueba de conectividad completada',
        timestamp: new Date().toISOString(),
        results: connectivityResults
      });

    } catch (error) {
      console.error('Error en prueba de conectividad:', error);
      return res.status(500).json({
        success: false,
        message: 'Error en prueba de conectividad',
        error: error.message
      });
    }
  }
};

module.exports = envCheckerController;