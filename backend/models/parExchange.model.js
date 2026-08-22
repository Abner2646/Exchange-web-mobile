// /models/parExchange.model.js

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

      // Filtro por fuente de precio
      if (filters.fuentePrecio) {
        whereClause.fuentePrecio = filters.fuentePrecio;
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
        order: [['volumen24h', 'DESC'], ['precioActual', 'DESC']]
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
        order: [['volumen24h', 'DESC'], ['precioActual', 'DESC']]
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
        order: [['volumen24h', 'DESC'], ['precioActual', 'DESC']]
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
        order: [['volumen24h', 'DESC'], ['precioActual', 'DESC']]
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
        order: [['volumen24h', 'DESC'], ['precioActual', 'DESC']]
      });
      return pares;
    } catch (error) {
      throw new Error(`Error al obtener pares activos: ${error.message}`);
    }
  };

  // CORREGIDO: Ahora ordena por volumen real
  ParExchange.getTopByVolume = async (limit = 10) => {
    try {
      const pares = await ParExchange.findAll({
        where: { 
          activo: true,
          volumen24h: { [Op.gt]: 0 }
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
        order: [['volumen24h', 'DESC']],
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
          activo: true,
          fuentePrecio: { [Op.ne]: 'manual' }
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

  // Métodos de estadísticas ACTUALIZADOS
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

      // Estadísticas de volumen
      const volumeStats = await ParExchange.findAll({
        attributes: [
          [sequelize.fn('SUM', sequelize.col('volumen24h')), 'volumenTotal'],
          [sequelize.fn('AVG', sequelize.col('volumen24h')), 'volumenPromedio'],
          [sequelize.fn('MAX', sequelize.col('volumen24h')), 'volumenMaximo']
        ],
        where: { 
          activo: true,
          volumen24h: { [Op.gt]: 0 }
        },
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

      // Distribución por fuente de precios
      const sourceDistribution = await ParExchange.findAll({
        attributes: [
          'fuentePrecio',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: { activo: true },
        group: ['fuentePrecio'],
        raw: true
      });

      // Pares más populares (por cripto base)
      const paresPorBase = await ParExchange.findAll({
        attributes: [
          'criptoBaseId',
          [sequelize.fn('COUNT', sequelize.col('criptoBaseId')), 'count'],
          [sequelize.fn('SUM', sequelize.col('volumen24h')), 'volumenTotal']
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
        order: [[sequelize.fn('SUM', sequelize.col('volumen24h')), 'DESC']],
        limit: 10,
        raw: false
      });

      // Pares más populares (por cripto quote)
      const paresPorQuote = await ParExchange.findAll({
        attributes: [
          'criptoQuoteId',
          [sequelize.fn('COUNT', sequelize.col('criptoQuoteId')), 'count'],
          [sequelize.fn('SUM', sequelize.col('volumen24h')), 'volumenTotal']
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
        order: [[sequelize.fn('SUM', sequelize.col('volumen24h')), 'DESC']],
        limit: 10,
        raw: false
      });

      // Cambios de precio (ganadores y perdedores)
      const gainersLosers = await ParExchange.findAll({
        where: { 
          activo: true,
          cambiosPorcentaje24h: { [Op.ne]: null }
        },
        attributes: ['id', 'cambiosPorcentaje24h'],
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoBase',
            attributes: ['symbol']
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptoQuote',
            attributes: ['symbol']
          }
        ],
        order: [['cambiosPorcentaje24h', 'DESC']],
        limit: 20
      });

      const topGainers = gainersLosers.slice(0, 5);
      const topLosers = gainersLosers.slice(-5).reverse();

      return {
        total: totalPares,
        activos: paresActivos,
        inactivos: paresInactivos,
        precios: priceStats[0] || {},
        volumen: volumeStats[0] || {},
        comisiones: commissionStats[0] || {},
        fuentesPrecios: sourceDistribution,
        paresPorBase: paresPorBase,
        paresPorQuote: paresPorQuote,
        mercado: {
          topGainers: topGainers,
          topLosers: topLosers
        }
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

      // Datos por defecto mejorados
      const createData = {
        ...data,
        ultimaActualizacion: new Date(),
        fuentePrecio: data.fuentePrecio || 'manual',
        volumen24h: data.volumen24h || 0,
        volumenBase24h: data.volumenBase24h || 0,
        cantidadOperaciones24h: data.cantidadOperaciones24h || 0,
        cambiosPorcentaje24h: data.cambiosPorcentaje24h || 0
      };

      const nuevoPar = await ParExchange.create(createData);
      
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

      // Calcular cambio de precio si se actualiza el precio
      if (data.precioActual) {
        const currentPar = await ParExchange.findByPk(id);
        if (currentPar && currentPar.precioActual) {
          data.precioAnterior = currentPar.precioActual;
          data.cambiosPorcentaje24h = ((data.precioActual - currentPar.precioActual) / currentPar.precioActual) * 100;
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
        precioActual: String(nuevoPrecio),
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
        comisionPorcentaje: String(nuevaComision)
      });
      return updated;
    } catch (error) {
      throw new Error(`Error al actualizar comisión: ${error.message}`);
    }
  };

  // Métodos para cálculos de exchange MEJORADOS
  ParExchange.calculateExchange = async (parId, cantidadBase, direction = 'buy') => {
    try {
      const par = await ParExchange.getById(parId);
      if (!par || !par.activo) {
        throw new Error('Par de exchange no encontrado o inactivo');
      }

      // Verificar que el precio no esté muy desactualizado
      const ahora = new Date();
      const ultimaActualizacion = new Date(par.ultimaActualizacion);
      const minutosDesdeActualizacion = (ahora - ultimaActualizacion) / (1000 * 60);

      if (minutosDesdeActualizacion > 10 && par.fuentePrecio !== 'manual') {
        console.warn(`Precio desactualizado para el par ${par.criptoBase.symbol}/${par.criptoQuote.symbol}`);
      }

      const cantidad = parseFloat(cantidadBase);
      const precio = parseFloat(par.precioActual);
      const comision = parseFloat(par.comisionPorcentaje);

      // Validar límites de cantidad
      const minAmount = 0.00000001;
      const maxAmount = 1000000;

      if (cantidad < minAmount || cantidad > maxAmount) {
        throw new Error(`La cantidad debe estar entre ${minAmount} y ${maxAmount}`);
      }

      let cantidadQuote, comisionMonto, cantidadFinal, impactoSlippage = 0;

      if (direction === 'buy') {
        // Comprar base con quote
        cantidadQuote = cantidad * precio;
        comisionMonto = cantidadQuote * (comision / 100);
        cantidadFinal = cantidadQuote + comisionMonto;
        
        // Simular slippage básico para órdenes grandes
        if (par.volumen24h > 0) {
          const porcentajeVolumen = cantidadQuote / par.volumen24h;
          if (porcentajeVolumen > 0.01) { // Si es más del 1% del volumen diario
            impactoSlippage = Math.min(porcentajeVolumen * 0.5, 0.05); // Max 5% slippage
          }
        }
      } else {
        // Vender base por quote
        cantidadQuote = cantidad * precio;
        comisionMonto = cantidadQuote * (comision / 100);
        cantidadFinal = cantidadQuote - comisionMonto;
        
        // Simular slippage para ventas
        if (par.volumen24h > 0) {
          const porcentajeVolumen = cantidadQuote / par.volumen24h;
          if (porcentajeVolumen > 0.01) {
            impactoSlippage = Math.min(porcentajeVolumen * 0.5, 0.05);
            cantidadFinal = cantidadFinal * (1 - impactoSlippage);
          }
        }
      }

      return {
        par: {
          base: par.criptoBase.symbol,
          quote: par.criptoQuote.symbol,
          precio: precio,
          volumen24h: par.volumen24h,
          ultimaActualizacion: par.ultimaActualizacion
        },
        calculo: {
          cantidadBase: cantidad,
          cantidadQuote: cantidadQuote,
          comisionPorcentaje: comision,
          comisionMonto: comisionMonto,
          impactoSlippage: impactoSlippage,
          cantidadFinal: cantidadFinal,
          direccion: direction,
          precioEfectivo: cantidadFinal / cantidad
        },
        advertencias: minutosDesdeActualizacion > 10 ? 
          [`Precio con ${Math.round(minutosDesdeActualizacion)} minutos de antigüedad`] : []
      };
    } catch (error) {
      throw new Error(`Error al calcular exchange: ${error.message}`);
    }
  };

  // Método para actualización masiva de precios MEJORADO
  ParExchange.bulkUpdatePrices = async (pricesData) => {
    try {
      const results = [];
      
      for (const priceData of pricesData) {
        try {
          const { baseSymbol, quoteSymbol, price, volume, change } = priceData;
          const par = await ParExchange.getBySymbols(baseSymbol, quoteSymbol);
          
          if (par && par.activo) {
            const updateData = {
              precioActual: String(price),
              ultimaActualizacion: new Date()
            };

            if (volume !== undefined) {
              updateData.volumen24h = String(volume);
            }

            if (change !== undefined) {
              updateData.cambiosPorcentaje24h = String(change);
            }

            const updated = await ParExchange.updatePar(par.id, updateData);
            results.push({
              par: `${baseSymbol}/${quoteSymbol}`,
              success: true,
              newPrice: price,
              volume: volume,
              change: change,
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
        results: results,
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`Error en actualización masiva de precios: ${error.message}`);
    }
  };

  // Nuevo método: Obtener libro de órdenes más realista
  ParExchange.getRealisticOrderBook = async (parId, depth = 10) => {
    try {
      const par = await ParExchange.getById(parId);
      
      if (!par || !par.activo) {
        throw new Error('Par de exchange no encontrado o inactivo');
      }

      const precioBase = parseFloat(par.precioActual);
      const volumenBase = parseFloat(par.volumen24h) || 100000;
      
      const bids = [];
      const asks = [];
      
      // Generar libro más realista basado en volumen
      for (let i = 1; i <= depth; i++) {
        const factor = i * 0.001; // 0.1% por nivel
        const volumeFactor = Math.random() * 0.3 + 0.1; // Entre 10% y 40% del volumen diario
        
        // Bids (órdenes de compra)
        const bidPrice = precioBase * (1 - factor);
        const bidQuantity = (volumenBase / 24) * volumeFactor * Math.random();
        bids.push({
          precio: parseFloat(bidPrice.toFixed(8)),
          cantidad: parseFloat(bidQuantity.toFixed(8)),
          total: parseFloat((bidPrice * bidQuantity).toFixed(8))
        });
        
        // Asks (órdenes de venta)
        const askPrice = precioBase * (1 + factor);
        const askQuantity = (volumenBase / 24) * volumeFactor * Math.random();
        asks.push({
          precio: parseFloat(askPrice.toFixed(8)),
          cantidad: parseFloat(askQuantity.toFixed(8)),
          total: parseFloat((askPrice * askQuantity).toFixed(8))
        });
      }

      const bestBid = Math.max(...bids.map(b => b.precio));
      const bestAsk = Math.min(...asks.map(a => a.precio));
      
      return {
        par: {
          id: par.id,
          base: par.criptoBase.symbol,
          quote: par.criptoQuote.symbol,
          precioActual: precioBase,
          volumen24h: par.volumen24h,
          ultimaActualizacion: par.ultimaActualizacion
        },
        libro: {
          bids: bids.sort((a, b) => b.precio - a.precio),
          asks: asks.sort((a, b) => a.precio - b.precio)
        },
        spread: {
          bid: bestBid,
          ask: bestAsk,
          spread: bestAsk - bestBid,
          spreadPorcentaje: ((bestAsk - bestBid) / precioBase * 100).toFixed(4)
        },
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`Error generando libro de órdenes: ${error.message}`);
    }
  };

  return ParExchange;
}

module.exports = createParExchangeModel;