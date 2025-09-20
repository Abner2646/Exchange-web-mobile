// models/blockchainState.model.js - Métodos para manejar el estado con estructura key-value
const initBlockchainState = require('./entities/blockchainState.entity');

function createBlockchainStateModel(sequelize) {
  const BlockchainState = initBlockchainState(sequelize);

  // =================== MÉTODOS ESTÁTICOS PARA GESTIÓN DE BLOQUES ===================
  
  BlockchainState.getLastProcessedBlock = async function(network) {
    try {
      const state = await this.findOne({
        where: { 
          network: network.toLowerCase(),
          key: 'last_processed_block'
        }
      });
      
      if (!state) {
        // Crear estado inicial para la red
        await this.create({
          network: network.toLowerCase(),
          key: 'last_processed_block',
          value: '0'
        });
        return 0;
      }
      
      return parseInt(state.value) || 0;
    } catch (error) {
      console.error(`Error obteniendo último bloque para ${network}:`, error.message);
      return 0;
    }
  };

  BlockchainState.updateLastProcessedBlock = async function(network, blockNumber) {
    try {
      const [state, created] = await this.findOrCreate({
        where: { 
          network: network.toLowerCase(),
          key: 'last_processed_block'
        },
        defaults: {
          network: network.toLowerCase(),
          key: 'last_processed_block',
          value: blockNumber.toString()
        }
      });

      if (!created) {
        await state.update({
          value: blockNumber.toString()
        });
      }

      // También actualizar timestamp del último escaneo
      await this.updateLastScanTimestamp(network);

      console.log(`✅ Último bloque actualizado para ${network}: ${blockNumber}`);
      return state;
    } catch (error) {
      console.error(`Error actualizando último bloque para ${network}:`, error.message);
      throw error;
    }
  };

  BlockchainState.updateLastScanTimestamp = async function(network) {
    try {
      const [state, created] = await this.findOrCreate({
        where: { 
          network: network.toLowerCase(),
          key: 'last_scan_timestamp'
        },
        defaults: {
          network: network.toLowerCase(),
          key: 'last_scan_timestamp',
          value: new Date().toISOString()
        }
      });

      if (!created) {
        await state.update({
          value: new Date().toISOString()
        });
      }

      return state;
    } catch (error) {
      console.error(`Error actualizando timestamp para ${network}:`, error.message);
    }
  };

  BlockchainState.getLastScanTimestamp = async function(network) {
    try {
      const state = await this.findOne({
        where: { 
          network: network.toLowerCase(),
          key: 'last_scan_timestamp'
        }
      });
      
      return state ? new Date(state.value) : null;
    } catch (error) {
      console.error(`Error obteniendo timestamp para ${network}:`, error.message);
      return null;
    }
  };

  BlockchainState.incrementDepositsFound = async function(network, count = 1) {
    try {
      const [state, created] = await this.findOrCreate({
        where: { 
          network: network.toLowerCase(),
          key: 'total_deposits_found'
        },
        defaults: {
          network: network.toLowerCase(),
          key: 'total_deposits_found',
          value: count.toString()
        }
      });

      if (!created) {
        const currentCount = parseInt(state.value) || 0;
        await state.update({
          value: (currentCount + count).toString()
        });
      }

      return state;
    } catch (error) {
      console.error(`Error incrementando depósitos para ${network}:`, error.message);
    }
  };

  BlockchainState.getTotalDepositsFound = async function(network) {
    try {
      const state = await this.findOne({
        where: { 
          network: network.toLowerCase(),
          key: 'total_deposits_found'
        }
      });
      
      return state ? parseInt(state.value) || 0 : 0;
    } catch (error) {
      console.error(`Error obteniendo total depósitos para ${network}:`, error.message);
      return 0;
    }
  };

  BlockchainState.getNetworkStats = async function(network) {
    try {
      const states = await this.findAll({
        where: { network: network.toLowerCase() }
      });

      const stats = {
        network: network.toLowerCase(),
        lastProcessedBlock: 0,
        lastScanTimestamp: null,
        totalDepositsFound: 0,
        isActive: true
      };

      states.forEach(state => {
        switch (state.key) {
          case 'last_processed_block':
            stats.lastProcessedBlock = parseInt(state.value) || 0;
            break;
          case 'last_scan_timestamp':
            stats.lastScanTimestamp = new Date(state.value);
            break;
          case 'total_deposits_found':
            stats.totalDepositsFound = parseInt(state.value) || 0;
            break;
          case 'is_active':
            stats.isActive = state.value === 'true';
            break;
        }
      });

      return stats;
    } catch (error) {
      console.error(`Error obteniendo stats para ${network}:`, error.message);
      return null;
    }
  };

  BlockchainState.getAllNetworksStats = async function() {
    try {
      const allStates = await this.findAll({
        order: [['network', 'ASC'], ['key', 'ASC']]
      });

      const networks = {};

      allStates.forEach(state => {
        if (!networks[state.network]) {
          networks[state.network] = {
            network: state.network,
            lastProcessedBlock: 0,
            lastScanTimestamp: null,
            totalDepositsFound: 0,
            isActive: true
          };
        }

        switch (state.key) {
          case 'last_processed_block':
            networks[state.network].lastProcessedBlock = parseInt(state.value) || 0;
            break;
          case 'last_scan_timestamp':
            networks[state.network].lastScanTimestamp = new Date(state.value);
            break;
          case 'total_deposits_found':
            networks[state.network].totalDepositsFound = parseInt(state.value) || 0;
            break;
          case 'is_active':
            networks[state.network].isActive = state.value === 'true';
            break;
        }
      });

      return Object.values(networks);
    } catch (error) {
      console.error('Error obteniendo stats de todas las redes:', error.message);
      return [];
    }
  };

  BlockchainState.setNetworkActive = async function(network, isActive = true) {
    try {
      const [state, created] = await this.findOrCreate({
        where: { 
          network: network.toLowerCase(),
          key: 'is_active'
        },
        defaults: {
          network: network.toLowerCase(),
          key: 'is_active',
          value: isActive.toString()
        }
      });

      if (!created) {
        await state.update({
          value: isActive.toString()
        });
      }

      console.log(`${isActive ? '✅' : '❌'} Red ${network} ${isActive ? 'activada' : 'desactivada'}`);
      return state;
    } catch (error) {
      console.error(`Error configurando estado de red ${network}:`, error.message);
      throw error;
    }
  };

  // =================== MÉTODOS PARA CONFIGURACIÓN AVANZADA ===================

  BlockchainState.setConfig = async function(network, key, value) {
    try {
      const [state, created] = await this.findOrCreate({
        where: { 
          network: network.toLowerCase(),
          key: key
        },
        defaults: {
          network: network.toLowerCase(),
          key: key,
          value: typeof value === 'object' ? JSON.stringify(value) : value.toString()
        }
      });

      if (!created) {
        await state.update({
          value: typeof value === 'object' ? JSON.stringify(value) : value.toString()
        });
      }

      return state;
    } catch (error) {
      console.error(`Error configurando ${key} para ${network}:`, error.message);
      throw error;
    }
  };

  BlockchainState.getConfig = async function(network, key, defaultValue = null) {
    try {
      const state = await this.findOne({
        where: { 
          network: network.toLowerCase(),
          key: key
        }
      });

      if (!state) {
        return defaultValue;
      }

      // Intentar parsear como JSON, si falla devolver como string
      try {
        return JSON.parse(state.value);
      } catch {
        return state.value;
      }
    } catch (error) {
      console.error(`Error obteniendo ${key} para ${network}:`, error.message);
      return defaultValue;
    }
  };

  return BlockchainState;
}

module.exports = createBlockchainStateModel;