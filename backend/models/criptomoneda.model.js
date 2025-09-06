// Importaciones
const initCriptomoneda = require('./entities/criptomoneda.entity');
const { Op } = require('sequelize');

function createCriptomonedaModel(sequelize) {
  const Criptomoneda = initCriptomoneda(sequelize);

  // Métodos de consulta básicos
  Criptomoneda.getById = async (id) => {
    try {
      const criptomoneda = await Criptomoneda.findByPk(id);
      return criptomoneda;
    } catch (error) {
      throw new Error(`Error al obtener criptomoneda por ID: ${error.message}`);
    }
  };

  Criptomoneda.getAll = async (filters = {}) => {
    try {
      const whereClause = {};
      
      // Filtros disponibles
      if (filters.activa !== undefined) {
        whereClause.activa = filters.activa === 'true';
      }
      
      if (filters.red) {
        whereClause.red = {
          [Op.iLike]: `%${filters.red}%`
        };
      }

      if (filters.symbol) {
        whereClause.symbol = {
          [Op.iLike]: `%${filters.symbol}%`
        };
      }

      if (filters.nombre) {
        whereClause.nombre = {
          [Op.iLike]: `%${filters.nombre}%`
        };
      }

      const criptomonedas = await Criptomoneda.findAll({
        where: whereClause,
        order: [['symbol', 'ASC']]
      });
      
      return criptomonedas;
    } catch (error) {
      throw new Error(`Error al obtener criptomonedas: ${error.message}`);
    }
  };

  Criptomoneda.search = async (term, limit = 10) => {
    try {
      const criptomonedas = await Criptomoneda.findAll({
        where: {
          [Op.and]: [
            { activa: true },
            {
              [Op.or]: [
                { symbol: { [Op.iLike]: `%${term}%` } },
                { nombre: { [Op.iLike]: `%${term}%` } },
                { red: { [Op.iLike]: `%${term}%` } }
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
  Criptomoneda.updateStatus = async (id, newStatus) => {
    try {
      const [updatedRowsCount] = await Criptomoneda.update(
        { activa: newStatus },
        { 
          where: { id },
          returning: true
        }
      );
      
      if (updatedRowsCount === 0) {
        throw new Error('Criptomoneda no encontrada');
      }
      
      const updatedCriptomoneda = await Criptomoneda.getById(id);
      return updatedCriptomoneda;
    } catch (error) {
      throw new Error(`Error al actualizar estado: ${error.message}`);
    }
  };

  Criptomoneda.getStats = async () => {
    try {
      const totalCriptomonedas = await Criptomoneda.count();
      const criptomonedasActivas = await Criptomoneda.count({
        where: { activa: true }
      });
      const criptomonedasInactivas = await Criptomoneda.count({
        where: { activa: false }
      });

      // Estadísticas por red
      const redesStats = await Criptomoneda.findAll({
        attributes: [
          'red',
          [sequelize.fn('COUNT', sequelize.col('red')), 'count']
        ],
        group: ['red'],
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
  Criptomoneda.getActive = async () => {
    try {
      const criptomonedas = await Criptomoneda.findAll({
        where: { activa: true },
        order: [['symbol', 'ASC']]
      });
      return criptomonedas;
    } catch (error) {
      throw new Error(`Error al obtener criptomonedas activas: ${error.message}`);
    }
  };

  Criptomoneda.getBySymbol = async (symbol) => {
    try {
      const criptomoneda = await Criptomoneda.findOne({
        where: { 
          symbol: symbol.toUpperCase(),
          activa: true 
        }
      });
      return criptomoneda;
    } catch (error) {
      throw new Error(`Error al obtener criptomoneda por símbolo: ${error.message}`);
    }
  };

  Criptomoneda.getByNetwork = async (red) => {
    try {
      const criptomonedas = await Criptomoneda.findAll({
        where: { 
          red: red,
          activa: true 
        },
        order: [['symbol', 'ASC']]
      });
      return criptomonedas;
    } catch (error) {
      throw new Error(`Error al obtener criptomonedas por red: ${error.message}`);
    }
  };

  Criptomoneda.getByContractAddress = async (direccionContrato) => {
    try {
      const criptomoneda = await Criptomoneda.findOne({
        where: { 
          direccionContrato: direccionContrato,
          activa: true 
        }
      });
      return criptomoneda;
    } catch (error) {
      throw new Error(`Error al obtener criptomoneda por dirección de contrato: ${error.message}`);
    }
  };

  Criptomoneda.createCriptomoneda = async (data) => {
    try {
      // Verificar si ya existe una criptomoneda con el mismo símbolo
      const existingBySymbol = await Criptomoneda.findOne({
        where: { symbol: data.symbol.toUpperCase() }
      });
      
      if (existingBySymbol) {
        throw new Error('Ya existe una criptomoneda con ese símbolo');
      }

      // Verificar dirección de contrato única si se proporciona
      if (data.direccionContrato) {
        const existingByContract = await Criptomoneda.findOne({
          where: { direccionContrato: data.direccionContrato }
        });
        
        if (existingByContract) {
          throw new Error('Ya existe una criptomoneda con esa dirección de contrato');
        }
      }

      // Convertir símbolo a mayúsculas
      const nuevaCriptomoneda = await Criptomoneda.create({
        ...data,
        symbol: data.symbol.toUpperCase()
      });
      
      return nuevaCriptomoneda;
    } catch (error) {
      throw new Error(`Error al crear criptomoneda: ${error.message}`);
    }
  };

  Criptomoneda.updateCriptomoneda = async (id, data) => {
    try {
      // Si se está actualizando el símbolo, verificar que no exista
      if (data.symbol) {
        const existingBySymbol = await Criptomoneda.findOne({
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
      if (data.direccionContrato) {
        const existingByContract = await Criptomoneda.findOne({
          where: { 
            direccionContrato: data.direccionContrato,
            id: { [Op.ne]: id }
          }
        });
        
        if (existingByContract) {
          throw new Error('Ya existe una criptomoneda con esa dirección de contrato');
        }
      }

      const [updatedRowsCount] = await Criptomoneda.update(data, {
        where: { id },
        returning: true
      });
      
      if (updatedRowsCount === 0) {
        throw new Error('Criptomoneda no encontrada');
      }
      
      const updatedCriptomoneda = await Criptomoneda.getById(id);
      return updatedCriptomoneda;
    } catch (error) {
      throw new Error(`Error al actualizar criptomoneda: ${error.message}`);
    }
  };

  Criptomoneda.deleteCriptomoneda = async (id) => {
    try {
      const deletedRowsCount = await Criptomoneda.destroy({
        where: { id }
      });
      
      if (deletedRowsCount === 0) {
        throw new Error('Criptomoneda no encontrada');
      }
      
      return { message: 'Criptomoneda eliminada correctamente' };
    } catch (error) {
      throw new Error(`Error al eliminar criptomoneda: ${error.message}`);
    }
  };

  // Métodos relacionados con transacciones
  Criptomoneda.validateForTransaction = async (symbol, amount) => {
    try {
      const criptomoneda = await Criptomoneda.getBySymbol(symbol);
      
      if (!criptomoneda) {
        throw new Error('Criptomoneda no encontrada o inactiva');
      }

      if (!criptomoneda.activa) {
        throw new Error('La criptomoneda está desactivada para transacciones');
      }

      // Validar decimales
      const decimalPlaces = (amount.toString().split('.')[1] || '').length;
      if (decimalPlaces > criptomoneda.decimales) {
        throw new Error(`Máximo ${criptomoneda.decimales} decimales permitidos para ${symbol}`);
      }

      return {
        valid: true,
        criptomoneda: criptomoneda,
        message: 'Criptomoneda válida para transacción'
      };
    } catch (error) {
      return {
        valid: false,
        message: error.message
      };
    }
  };

  return Criptomoneda;
}

module.exports = createCriptomonedaModel;