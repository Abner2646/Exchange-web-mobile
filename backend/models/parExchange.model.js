// Importaciones
const initParExchange = require('./entities/parExchange.entity');
const { Op } = require('sequelize');

function createParExchangeModel(sequelize) {
  const ParExchange = initParExchange(sequelize);

  // Métodos de consulta básicos
  ParExchange.getById = async (id) => {
    try {
      const par = await ParExchange.findByPk(id, {
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoBase',
            attributes: ['id', 'symbol', 'nombre', 'red']
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoQuote',
            attributes: ['id', 'symbol', 'nombre', 'red']
          }
        ]
      });
      return par;
    } catch (error) {
      throw new Error(`Error al obtener par de exchange por ID: ${error.message}`);
    }
  };

  ParExchange.getAll = async (filters = {}) => {
    try {
      const whereClause = {};
      
      // Filtros disponibles
      if (filters.criptoBaseId) {
        whereClause.criptoBaseId = filters.criptoBaseId;
      }
      
      if (filters.criptoQuoteId) {
        whereClause.criptoQuoteId = filters.criptoQuoteId;
      }

      if (filters.activo !== undefined) {
        whereClause.activo = filters.activo === 'true';
      }

      // Filtros de precio
      if (filters.precioMin) {
        whereClause.precioActual = {
          [Op.gte]: parseFloat(filters.precioMin)
        };
      }

      if (filters.precioMax) {
        whereClause.precioActual = {
          ...whereClause.precioActual,
          [Op.lte]: parseFloat(filters.precioMax)
        };
      }

      // Filtros de comisión
      if (filters.comisionMin) {
        whereClause.comisionPorcentaje = {
          [Op.gte]: parseFloat(filters.comisionMin)
        };
      }

      if (filters.comisionMax) {
        whereClause.comisionPorcentaje = {
          ...whereClause.comisionPorcentaje,
          [Op.lte]: parseFloat(filters.comisionMax)
        };
      }

      const pares = await ParExchange.findAll({
        where: whereClause,
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoBase',
            attributes: ['id', 'symbol', 'nombre', 'red']
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoQuote',
            attributes: ['id', 'symbol', 'nombre', 'red']
          }
        ],
        order: [['precioActual', 'DESC']]
      });
      
      return pares;
    } catch (error) {
      throw new Error(`Error al obtener pares de exchange: ${error.message}`);
    }
  };

  ParExchange.search = async (term, limit = 10) => {
    try {
      const pares = await ParExchange.findAll({
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoBase',
            attributes: ['id', 'symbol', 'nombre', 'red'],
            where: {
              [Op.or]: [
                { symbol: { [Op.iLike]: `%${term}%` } },
                { nombre: { [Op.iLike]: `%${term}%` } }
              ]
            }
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoQuote',
            attributes: ['id', 'symbol', 'nombre', 'red']
          }
        ],
        limit: parseInt(limit),
        order: [['precioActual', 'DESC']]
      });
      
      return pares;
    } catch (error) {
      throw new Error(`Error en búsqueda de pares de exchange: ${error.message}`);
    }
  };

  // Métodos específicos para pares de exchange
  ParExchange.getBySymbols = async (baseSymbol, quoteSymbol) => {
    try {
      const par = await ParExchange.findOne({
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoBase',
            attributes: ['id', 'symbol', 'nombre', 'red'],
            where: { symbol: baseSymbol.toUpperCase() }
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoQuote',
            attributes: ['id', 'symbol', 'nombre', 'red'],
            where: { symbol: quoteSymbol.toUpperCase() }
          }
        ]
      });
      return par;
    } catch (error) {
      throw new Error(`Error al obtener par por símbolos: ${error.message}`);
    }
  };

  ParExchange.getByBaseCrypto = async (criptoBaseId) => {
    try {
      const pares = await ParExchange.findAll({
        where: { 
          criptoBaseId: criptoBaseId,
          activo: true 
        },
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoBase',
            attributes: ['id', 'symbol', 'nombre', 'red']
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoQuote',
            attributes: ['id', 'symbol', 'nombre', 'red']
          }
        ],
        order: [['precioActual', 'DESC']]
      });
      return pares;
    } catch (error) {
      throw new Error(`Error al obtener pares por cripto base: ${error.message}`);
    }
  };

  ParExchange.getByQuoteCrypto = async (criptoQuoteId) => {
    try {
      const pares = await ParExchange.findAll({
        where: { 
          criptoQuoteId: criptoQuoteId,
          activo: true 
        },
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoBase',
            attributes: ['id', 'symbol', 'nombre', 'red']
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoQuote',
            attributes: ['id', 'symbol', 'nombre', 'red']
          }
        ],
        order: [['precioActual', 'DESC']]
      });
      return pares;
    } catch (error) {
      throw new Error(`Error al obtener pares por cripto quote: ${error.message}`);
    }
  };

  ParExchange.getActive = async () => {
    try {
      const pares = await ParExchange.findAll({
        where: { activo: true },
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoBase',
            attributes: ['id', 'symbol', 'nombre', 'red']
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoQuote',
            attributes: ['id', 'symbol', 'nombre', 'red']
          }
        ],
        order: [['precioActual', 'DESC']]
      });
      return pares;
    } catch (error) {
      throw new Error(`Error al obtener pares activos: ${error.message}`);
    }
  };

  ParExchange.getTopByVolume = async (limit = 10) => {
    try {
      const pares = await ParExchange.findAll({
        where: { activo: true },
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoBase',
            attributes: ['id', 'symbol', 'nombre', 'red']
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoQuote',
            attributes: ['id', 'symbol', 'nombre', 'red']
          }
        ],
        order: [['precioActual', 'DESC']],
        limit: parseInt(limit)
      });
      return pares;
    } catch (error) {
      throw new Error(`Error al obtener top pares por volumen: ${error.message}`);
    }
  };

  ParExchange.getHighCommission = async (threshold = 0.01) => {
    try {
      const pares = await ParExchange.findAll({
        where: { 
          comisionPorcentaje: { [Op.gte]: threshold },
          activo: true 
        },
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoBase',
            attributes: ['id', 'symbol', 'nombre', 'red']
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoQuote',
            attributes: ['id', 'symbol', 'nombre', 'red']
          }
        ],
        order: [['comisionPorcentaje', 'DESC']]
      });
      return pares;
    } catch (error) {
      throw new Error(`Error al obtener pares con comisión alta: ${error.message}`);
    }
  };

  ParExchange.getOutdatedPrices = async (minutes = 60) => {
    try {
      const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
      
      const pares = await ParExchange.findAll({
        where: {
          ultimaActualizacion: { [Op.lt]: cutoffTime },
          activo: true
        },
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoBase',
            attributes: ['id', 'symbol', 'nombre', 'red']
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoQuote',
            attributes: ['id', 'symbol', 'nombre', 'red']
          }
        ],
        order: [['ultimaActualizacion', 'ASC']]
      });
      return pares;
    } catch (error) {
      throw new Error(`Error al obtener pares con precios desactualizados: ${error.message}`);
    }
  };

  // Métodos de estadísticas
  ParExchange.getStats = async () => {
    try {
      const totalPares = await ParExchange.count();
      const paresActivos = await ParExchange.count({
        where: { activo: true }
      });
      const paresInactivos = await ParExchange.count({
        where: { activo: false }
      });

      // Estadísticas de precios
      const priceStats = await ParExchange.findAll({
        attributes: [
          [sequelize.fn('AVG', sequelize.col('precioActual')), 'precioPromedio'],
          [sequelize.fn('MIN', sequelize.col('precioActual')), 'precioMinimo'],
          [sequelize.fn('MAX', sequelize.col('precioActual')), 'precioMaximo']
        ],
        where: { activo: true },
        raw: true
      });

      // Estadísticas de comisiones
      const commissionStats = await ParExchange.findAll({
        attributes: [
          [sequelize.fn('AVG', sequelize.col('comisionPorcentaje')), 'comisionPromedio'],
          [sequelize.fn('MIN', sequelize.col('comisionPorcentaje')), 'comisionMinima'],
          [sequelize.fn('MAX', sequelize.col('comisionPorcentaje')), 'comisionMaxima']
        ],
        where: { activo: true },
        raw: true
      });

      // Pares más populares (por cripto base)
      const paresPorBase = await ParExchange.findAll({
        attributes: [
          'criptoBaseId',
          [sequelize.fn('COUNT', sequelize.col('criptoBaseId')), 'count']
        ],
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoBase',
            attributes: ['symbol', 'nombre']
          }
        ],
        where: { activo: true },
        group: ['criptoBaseId', 'criptoBase.id'],
        order: [[sequelize.fn('COUNT', sequelize.col('criptoBaseId')), 'DESC']],
        limit: 10,
        raw: false
      });

      // Pares más populares (por cripto quote)
      const paresPorQuote = await ParExchange.findAll({
        attributes: [
          'criptoQuoteId',
          [sequelize.fn('COUNT', sequelize.col('criptoQuoteId')), 'count']
        ],
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoQuote',
            attributes: ['symbol', 'nombre']
          }
        ],
        where: { activo: true },
        group: ['criptoQuoteId', 'criptoQuote.id'],
        order: [[sequelize.fn('COUNT', sequelize.col('criptoQuoteId')), 'DESC']],
        limit: 10,
        raw: false
      });

      return {
        total: totalPares,
        activos: paresActivos,
        inactivos: paresInactivos,
        precios: priceStats[0] || {},
        comisiones: commissionStats[0] || {},
        paresPorBase: paresPorBase,
        paresPorQuote: paresPorQuote
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  };

  // Métodos CRUD
  ParExchange.createPar = async (data) => {
    try {
      // Verificar que no existe ya un par con esas criptomonedas
      const existingPar = await ParExchange.findOne({
        where: { 
          criptoBaseId: data.criptoBaseId,
          criptoQuoteId: data.criptoQuoteId
        }
      });
      
      if (existingPar) {
        throw new Error('Ya existe un par de exchange con esas criptomonedas');
      }

      // Verificar que las criptomonedas son diferentes
      if (data.criptoBaseId === data.criptoQuoteId) {
        throw new Error('La criptomoneda base y quote deben ser diferentes');
      }

      // Verificar que las criptomonedas existen
      const criptoBase = await sequelize.models.Criptomoneda.findByPk(data.criptoBaseId);
      const criptoQuote = await sequelize.models.Criptomoneda.findByPk(data.criptoQuoteId);
      
      if (!criptoBase || !criptoQuote) {
        throw new Error('Una o ambas criptomonedas no existen');
      }

      const nuevoPar = await ParExchange.create({
        ...data,
        ultimaActualizacion: new Date()
      });
      
      return await ParExchange.getById(nuevoPar.id);
    } catch (error) {
      throw new Error(`Error al crear par de exchange: ${error.message}`);
    }
  };

  ParExchange.updatePar = async (id, data) => {
    try {
      // Si se están actualizando las criptomonedas, verificar que no exista otro par igual
      if (data.criptoBaseId || data.criptoQuoteId) {
        const currentPar = await ParExchange.findByPk(id);
        if (!currentPar) {
          throw new Error('Par de exchange no encontrado');
        }

        const newBaseId = data.criptoBaseId || currentPar.criptoBaseId;
        const newQuoteId = data.criptoQuoteId || currentPar.criptoQuoteId;

        if (newBaseId === newQuoteId) {
          throw new Error('La criptomoneda base y quote deben ser diferentes');
        }

        const existingPar = await ParExchange.findOne({
          where: { 
            criptoBaseId: newBaseId,
            criptoQuoteId: newQuoteId,
            id: { [Op.ne]: id }
          }
        });
        
        if (existingPar) {
          throw new Error('Ya existe un par de exchange con esas criptomonedas');
        }
      }

      const [updatedRowsCount] = await ParExchange.update({
        ...data,
        ...(data.precioActual && { ultimaActualizacion: new Date() })
      }, {
        where: { id },
        returning: true
      });
      
      if (updatedRowsCount === 0) {
        throw new Error('Par de exchange no encontrado');
      }
      
      const updatedPar = await ParExchange.getById(id);
      return updatedPar;
    } catch (error) {
      throw new Error(`Error al actualizar par de exchange: ${error.message}`);
    }
  };

  ParExchange.deletePar = async (id) => {
    try {
      const deletedRowsCount = await ParExchange.destroy({
        where: { id }
      });
      
      if (deletedRowsCount === 0) {
        throw new Error('Par de exchange no encontrado');
      }
      
      return { message: 'Par de exchange eliminado correctamente' };
    } catch (error) {
      throw new Error(`Error al eliminar par de exchange: ${error.message}`);
    }
  };

  // Métodos de gestión de estado y precios
  ParExchange.updateStatus = async (id, newStatus) => {
    try {
      const updated = await ParExchange.updatePar(id, { activo: newStatus });
      return updated;
    } catch (error) {
      throw new Error(`Error al actualizar estado: ${error.message}`);
    }
  };

  ParExchange.updatePrice = async (id, nuevoPrecio) => {
    try {
      if (nuevoPrecio <= 0) {
        throw new Error('El precio debe ser mayor a 0');
      }

      const updated = await ParExchange.updatePar(id, {
        precioActual: parseFloat(nuevoPrecio),
        ultimaActualizacion: new Date()
      });
      return updated;
    } catch (error) {
      throw new Error(`Error al actualizar precio: ${error.message}`);
    }
  };

  ParExchange.updateCommission = async (id, nuevaComision) => {
    try {
      if (nuevaComision < 0 || nuevaComision > 100) {
        throw new Error('La comisión debe estar entre 0 y 100%');
      }

      const updated = await ParExchange.updatePar(id, {
        comisionPorcentaje: parseFloat(nuevaComision)
      });
      return updated;
    } catch (error) {
      throw new Error(`Error al actualizar comisión: ${error.message}`);
    }
  };

  // Métodos para cálculos de exchange
  ParExchange.calculateExchange = async (parId, cantidadBase, direction = 'buy') => {
    try {
      const par = await ParExchange.getById(parId);
      if (!par || !par.activo) {
        throw new Error('Par de exchange no encontrado o inactivo');
      }

      const cantidad = parseFloat(cantidadBase);
      const precio = parseFloat(par.precioActual);
      const comision = parseFloat(par.comisionPorcentaje);

      let cantidadQuote, comisionMonto, cantidadFinal;

      if (direction === 'buy') {
        // Comprar base con quote
        cantidadQuote = cantidad * precio;
        comisionMonto = cantidadQuote * (comision / 100);
        cantidadFinal = cantidadQuote + comisionMonto;
      } else {
        // Vender base por quote
        cantidadQuote = cantidad * precio;
        comisionMonto = cantidadQuote * (comision / 100);
        cantidadFinal = cantidadQuote - comisionMonto;
      }

      return {
        par: {
          base: par.criptoBase.symbol,
          quote: par.criptoQuote.symbol,
          precio: precio
        },
        calculo: {
          cantidadBase: cantidad,
          cantidadQuote: cantidadQuote,
          comisionPorcentaje: comision,
          comisionMonto: comisionMonto,
          cantidadFinal: cantidadFinal,
          direccion: direction
        }
      };
    } catch (error) {
      throw new Error(`Error al calcular exchange: ${error.message}`);
    }
  };

  // Método para actualización masiva de precios
  ParExchange.bulkUpdatePrices = async (pricesData) => {
    try {
      const results = [];
      
      for (const priceData of pricesData) {
        try {
          const { baseSymbol, quoteSymbol, price } = priceData;
          const par = await ParExchange.getBySymbols(baseSymbol, quoteSymbol);
          
          if (par && par.activo) {
            const updated = await ParExchange.updatePrice(par.id, price);
            results.push({
              par: `${baseSymbol}/${quoteSymbol}`,
              success: true,
              newPrice: price,
              updatedAt: updated.ultimaActualizacion
            });
          } else {
            results.push({
              par: `${baseSymbol}/${quoteSymbol}`,
              success: false,
              error: 'Par no encontrado o inactivo'
            });
          }
        } catch (error) {
          results.push({
            par: `${priceData.baseSymbol}/${priceData.quoteSymbol}`,
            success: false,
            error: error.message
          });
        }
      }

      return {
        totalProcessed: pricesData.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results: results
      };
    } catch (error) {
      throw new Error(`Error en actualización masiva de precios: ${error.message}`);
    }
  };

  return ParExchange;
}

module.exports = createParExchangeModel;