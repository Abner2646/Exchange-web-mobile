// models/crypto.model.js
const initCrypto = require('./crypto.entity');
const { Op } = require('sequelize');

function createCryptoModel(sequelize) {
  const Crypto = initCrypto(sequelize);

  // Métodos de consulta básicos
  Crypto.getById = async (id) => {
    try {
      const crypto = await Crypto.findByPk(id);
      return crypto;
    } catch (error) {
      throw new Error(`Error al obtener criptomoneda por ID: ${error.message}`);
    }
  };

  Crypto.getAll = async (filters = {}) => {
    try {
      const whereClause = {};
      
      // Filtros disponibles
      if (filters.active !== undefined) {
        whereClause.active = filters.active === 'true';
      }
      
      if (filters.network) {
        whereClause.network = {
          [Op.iLike]: `%${filters.network}%`
        };
      }

      if (filters.symbol) {
        whereClause.symbol = {
          [Op.iLike]: `%${filters.symbol}%`
        };
      }

      if (filters.name) {
        whereClause.name = {
          [Op.iLike]: `%${filters.name}%`
        };
      }

      const criptomonedas = await Crypto.findAll({
        where: whereClause,
        order: [['symbol', 'ASC']]
      });
      
      return criptomonedas;
    } catch (error) {
      throw new Error(`Error al obtener criptomonedas: ${error.message}`);
    }
  };

  Crypto.search = async (term, limit = 10) => {
    try {
      const criptomonedas = await Crypto.findAll({
        where: {
          [Op.and]: [
            { active: true },
            {
              [Op.or]: [
                { symbol: { [Op.iLike]: `%${term}%` } },
                { name: { [Op.iLike]: `%${term}%` } },
                { network: { [Op.iLike]: `%${term}%` } }
              ]
            }
          ]
        },
        limit: parseInt(limit),
        order: [['symbol', 'ASC']]
      });
      
      return criptomonedas;
    } catch (error) {
      throw new Error(`Error en búsqueda de criptomonedas: ${error.message}`);
    }
  };

  // Métodos administrativos
  Crypto.updateStatus = async (id, newStatus) => {
    try {
      const [updatedRowsCount] = await Crypto.update(
        { active: newStatus },
        { 
          where: { id },
          returning: true
        }
      );
      
      if (updatedRowsCount === 0) {
        throw new Error('Criptomoneda no encontrada');
      }
      
      const updatedCriptomoneda = await Crypto.getById(id);
      return updatedCriptomoneda;
    } catch (error) {
      throw new Error(`Error al actualizar estado: ${error.message}`);
    }
  };

  Crypto.getStats = async () => {
    try {
      const totalCriptomonedas = await Crypto.count();
      const criptomonedasActivas = await Crypto.count({
        where: { active: true }
      });
      const criptomonedasInactivas = await Crypto.count({
        where: { active: false }
      });

      // Estadísticas por network
      const redesStats = await Crypto.findAll({
        attributes: [
          'network',
          [sequelize.fn('COUNT', sequelize.col('network')), 'count']
        ],
        group: ['network'],
        raw: true
      });

      return {
        total: totalCriptomonedas,
        activas: criptomonedasActivas,
        inactivas: criptomonedasInactivas,
        porRed: redesStats
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  };

  // Métodos específicos para criptomonedas
  Crypto.getActive = async () => {
    try {
      const criptomonedas = await Crypto.findAll({
        where: { active: true },
        order: [['symbol', 'ASC']]
      });
      return criptomonedas;
    } catch (error) {
      throw new Error(`Error al obtener criptomonedas activas: ${error.message}`);
    }
  };

  Crypto.getBySymbol = async (symbol) => {
    try {
      const crypto = await Crypto.findOne({
        where: { 
          symbol: symbol.toUpperCase(),
          active: true 
        }
      });
      return crypto;
    } catch (error) {
      throw new Error(`Error al obtener criptomoneda por símbolo: ${error.message}`);
    }
  };

  Crypto.getByNetwork = async (network) => {
    try {
      const criptomonedas = await Crypto.findAll({
        where: { 
          network: network,
          active: true 
        },
        order: [['symbol', 'ASC']]
      });
      return criptomonedas;
    } catch (error) {
      throw new Error(`Error al obtener criptomonedas por network: ${error.message}`);
    }
  };

  Crypto.getByContractAddress = async (contractAddress) => {
    try {
      const crypto = await Crypto.findOne({
        where: { 
          contractAddress: contractAddress,
          active: true 
        }
      });
      return crypto;
    } catch (error) {
      throw new Error(`Error al obtener criptomoneda por dirección de contrato: ${error.message}`);
    }
  };

  // ✨ Método helper para generar URL de icono
  Crypto.generateIconUrl = (symbol) => {
    // Usar SVG transparente de jsDelivr
    return `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${symbol.toLowerCase()}.svg`;
    
    // O si preferís PNG 128x128:
    // return `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${symbol.toLowerCase()}.png`;
  };

  // Crear crypto (MÉTODO ÚNICO CORREGIDO)
  Crypto.createCrypto = async (data) => {
    try {
      // Verificar si ya existe una criptomoneda con el mismo símbolo
      const existingBySymbol = await Crypto.findOne({
        where: { symbol: data.symbol.toUpperCase() }
      });
      
      if (existingBySymbol) {
        throw new Error('Ya existe una criptomoneda con ese símbolo');
      }

      // Verificar dirección de contrato única si se proporciona
      if (data.contractAddress) {
        const existingByContract = await Crypto.findOne({
          where: { contractAddress: data.contractAddress }
        });
        
        if (existingByContract) {
          throw new Error('Ya existe una criptomoneda con esa dirección de contrato');
        }
      }

      // ✨ Auto-generar iconUrl si no se proporciona
      if (!data.iconUrl) {
        data.iconUrl = Crypto.generateIconUrl(data.symbol);
      }

      // Convertir símbolo a mayúsculas y crear
      const nuevaCriptomoneda = await Crypto.create({
        ...data,
        symbol: data.symbol.toUpperCase()
      });
      
      return nuevaCriptomoneda;
    } catch (error) {
      throw new Error(`Error al crear crypto: ${error.message}`);
    }
  };

  Crypto.updateCriptomoneda = async (id, data) => {
    try {
      // Si se está actualizando el símbolo, verificar que no exista
      if (data.symbol) {
        const existingBySymbol = await Crypto.findOne({
          where: { 
            symbol: data.symbol.toUpperCase(),
            id: { [Op.ne]: id }
          }
        });
        
        if (existingBySymbol) {
          throw new Error('Ya existe una criptomoneda con ese símbolo');
        }
        data.symbol = data.symbol.toUpperCase();
      }

      // Verificar dirección de contrato única si se actualiza
      if (data.contractAddress) {
        const existingByContract = await Crypto.findOne({
          where: { 
            contractAddress: data.contractAddress,
            id: { [Op.ne]: id }
          }
        });
        
        if (existingByContract) {
          throw new Error('Ya existe una criptomoneda con esa dirección de contrato');
        }
      }

      const [updatedRowsCount] = await Crypto.update(data, {
        where: { id },
        returning: true
      });
      
      if (updatedRowsCount === 0) {
        throw new Error('Criptomoneda no encontrada');
      }
      
      const updatedCriptomoneda = await Crypto.getById(id);
      return updatedCriptomoneda;
    } catch (error) {
      throw new Error(`Error al actualizar crypto: ${error.message}`);
    }
  };

  Crypto.deleteCriptomoneda = async (id) => {
    try {
      const deletedRowsCount = await Crypto.destroy({
        where: { id }
      });
      
      if (deletedRowsCount === 0) {
        throw new Error('Criptomoneda no encontrada');
      }
      
      return { message: 'Criptomoneda eliminada correctamente' };
    } catch (error) {
      throw new Error(`Error al eliminar crypto: ${error.message}`);
    }
  };

  // Métodos relacionados con transacciones
  Crypto.validateForTransaction = async (symbol, amount) => {
    try {
      const crypto = await Crypto.getBySymbol(symbol);
      
      if (!crypto) {
        throw new Error('Criptomoneda no encontrada o inactiva');
      }

      if (!crypto.active) {
        throw new Error('La criptomoneda está desactivada para transacciones');
      }

      // Validar decimals
      const decimalPlaces = (amount.toString().split('.')[1] || '').length;
      if (decimalPlaces > crypto.decimals) {
        throw new Error(`Máximo ${crypto.decimals} decimals permitidos para ${symbol}`);
      }

      return {
        valid: true,
        crypto: crypto,
        message: 'Criptomoneda válida para transacción'
      };
    } catch (error) {
      return {
        valid: false,
        message: error.message
      };
    }
  };

  return Crypto;
}

module.exports = createCryptoModel;