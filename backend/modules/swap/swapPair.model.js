// /models/parExchange.model.js

// Importaciones
const initParExchange = require('./swapPair.entity');
const { Op } = require('sequelize');

function createParExchangeModel(sequelize) {
  const SwapPair = initParExchange(sequelize);

  // Métodos de consulta básicos
  SwapPair.getById = async (id) => {
    try {
      const par = await SwapPair.findByPk(id, {
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'baseCrypto',
            attributes: ['id', 'symbol', 'name', 'network']
          },
          {
            model: sequelize.models.Crypto,
            as: 'quoteCrypto',
            attributes: ['id', 'symbol', 'name', 'network']
          }
        ]
      });
      return par;
    } catch (error) {
      throw new Error(`Error al obtener par de exchange por ID: ${error.message}`);
    }
  };

  SwapPair.getAll = async (filters = {}) => {
    try {
      const whereClause = {};
      
      // Filtros disponibles
      if (filters.baseCryptoId) {
        whereClause.baseCryptoId = filters.baseCryptoId;
      }
      
      if (filters.quoteCryptoId) {
        whereClause.quoteCryptoId = filters.quoteCryptoId;
      }

      if (filters.active !== undefined) {
        whereClause.active = filters.active === 'true';
      }

      // Filtros de price
      if (filters.precioMin) {
        whereClause.currentPrice = {
          [Op.gte]: parseFloat(filters.precioMin)
        };
      }

      if (filters.precioMax) {
        whereClause.currentPrice = {
          ...whereClause.currentPrice,
          [Op.lte]: parseFloat(filters.precioMax)
        };
      }

      // Filtros de comisión
      if (filters.comisionMin) {
        whereClause.feePercent = {
          [Op.gte]: parseFloat(filters.comisionMin)
        };
      }

      if (filters.comisionMax) {
        whereClause.feePercent = {
          ...whereClause.feePercent,
          [Op.lte]: parseFloat(filters.comisionMax)
        };
      }

      // Filtro por fuente de price
      if (filters.priceSource) {
        whereClause.priceSource = filters.priceSource;
      }

      const pares = await SwapPair.findAll({
        where: whereClause,
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'baseCrypto',
            attributes: ['id', 'symbol', 'name', 'network']
          },
          {
            model: sequelize.models.Crypto,
            as: 'quoteCrypto',
            attributes: ['id', 'symbol', 'name', 'network']
          }
        ],
        order: [['volume24h', 'DESC'], ['currentPrice', 'DESC']]
      });
      
      return pares;
    } catch (error) {
      throw new Error(`Error al obtener pares de exchange: ${error.message}`);
    }
  };

  SwapPair.search = async (term, limit = 10) => {
    try {
      const pares = await SwapPair.findAll({
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'baseCrypto',
            attributes: ['id', 'symbol', 'name', 'network'],
            where: {
              [Op.or]: [
                { symbol: { [Op.iLike]: `%${term}%` } },
                { name: { [Op.iLike]: `%${term}%` } }
              ]
            }
          },
          {
            model: sequelize.models.Crypto,
            as: 'quoteCrypto',
            attributes: ['id', 'symbol', 'name', 'network']
          }
        ],
        limit: parseInt(limit),
        order: [['volume24h', 'DESC'], ['currentPrice', 'DESC']]
      });
      
      return pares;
    } catch (error) {
      throw new Error(`Error en búsqueda de pares de exchange: ${error.message}`);
    }
  };

  // Métodos específicos para pares de exchange
  SwapPair.getBySymbols = async (baseSymbol, quoteSymbol) => {
    try {
      const par = await SwapPair.findOne({
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'baseCrypto',
            attributes: ['id', 'symbol', 'name', 'network'],
            where: { symbol: baseSymbol.toUpperCase() }
          },
          {
            model: sequelize.models.Crypto,
            as: 'quoteCrypto',
            attributes: ['id', 'symbol', 'name', 'network'],
            where: { symbol: quoteSymbol.toUpperCase() }
          }
        ]
      });
      return par;
    } catch (error) {
      throw new Error(`Error al obtener par por símbolos: ${error.message}`);
    }
  };

  SwapPair.getByBaseCrypto = async (baseCryptoId) => {
    try {
      const pares = await SwapPair.findAll({
        where: { 
          baseCryptoId: baseCryptoId,
          active: true 
        },
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'baseCrypto',
            attributes: ['id', 'symbol', 'name', 'network']
          },
          {
            model: sequelize.models.Crypto,
            as: 'quoteCrypto',
            attributes: ['id', 'symbol', 'name', 'network']
          }
        ],
        order: [['volume24h', 'DESC'], ['currentPrice', 'DESC']]
      });
      return pares;
    } catch (error) {
      throw new Error(`Error al obtener pares por cripto base: ${error.message}`);
    }
  };

  SwapPair.getByQuoteCrypto = async (quoteCryptoId) => {
    try {
      const pares = await SwapPair.findAll({
        where: { 
          quoteCryptoId: quoteCryptoId,
          active: true 
        },
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'baseCrypto',
            attributes: ['id', 'symbol', 'name', 'network']
          },
          {
            model: sequelize.models.Crypto,
            as: 'quoteCrypto',
            attributes: ['id', 'symbol', 'name', 'network']
          }
        ],
        order: [['volume24h', 'DESC'], ['currentPrice', 'DESC']]
      });
      return pares;
    } catch (error) {
      throw new Error(`Error al obtener pares por cripto quote: ${error.message}`);
    }
  };

  SwapPair.getActive = async () => {
    try {
      const pares = await SwapPair.findAll({
        where: { active: true },
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'baseCrypto',
            attributes: ['id', 'symbol', 'name', 'network']
          },
          {
            model: sequelize.models.Crypto,
            as: 'quoteCrypto',
            attributes: ['id', 'symbol', 'name', 'network']
          }
        ],
        order: [['volume24h', 'DESC'], ['currentPrice', 'DESC']]
      });
      return pares;
    } catch (error) {
      throw new Error(`Error al obtener pares activos: ${error.message}`);
    }
  };

  // CORREGIDO: Ahora ordena por volumen real
  SwapPair.getTopByVolume = async (limit = 10) => {
    try {
      const pares = await SwapPair.findAll({
        where: { 
          active: true,
          volume24h: { [Op.gt]: 0 }
        },
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'baseCrypto',
            attributes: ['id', 'symbol', 'name', 'network']
          },
          {
            model: sequelize.models.Crypto,
            as: 'quoteCrypto',
            attributes: ['id', 'symbol', 'name', 'network']
          }
        ],
        order: [['volume24h', 'DESC']],
        limit: parseInt(limit)
      });
      return pares;
    } catch (error) {
      throw new Error(`Error al obtener top pares por volumen: ${error.message}`);
    }
  };

  SwapPair.getHighCommission = async (threshold = 0.01) => {
    try {
      const pares = await SwapPair.findAll({
        where: { 
          feePercent: { [Op.gte]: threshold },
          active: true 
        },
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'baseCrypto',
            attributes: ['id', 'symbol', 'name', 'network']
          },
          {
            model: sequelize.models.Crypto,
            as: 'quoteCrypto',
            attributes: ['id', 'symbol', 'name', 'network']
          }
        ],
        order: [['feePercent', 'DESC']]
      });
      return pares;
    } catch (error) {
      throw new Error(`Error al obtener pares con comisión alta: ${error.message}`);
    }
  };

  SwapPair.getOutdatedPrices = async (minutes = 60) => {
    try {
      const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
      
      const pares = await SwapPair.findAll({
        where: {
          lastUpdated: { [Op.lt]: cutoffTime },
          active: true,
          priceSource: { [Op.ne]: 'manual' }
        },
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'baseCrypto',
            attributes: ['id', 'symbol', 'name', 'network']
          },
          {
            model: sequelize.models.Crypto,
            as: 'quoteCrypto',
            attributes: ['id', 'symbol', 'name', 'network']
          }
        ],
        order: [['lastUpdated', 'ASC']]
      });
      return pares;
    } catch (error) {
      throw new Error(`Error al obtener pares con precios desactualizados: ${error.message}`);
    }
  };

  // Métodos de estadísticas ACTUALIZADOS
  SwapPair.getStats = async () => {
    try {
      const totalPares = await SwapPair.count();
      const paresActivos = await SwapPair.count({
        where: { active: true }
      });
      const paresInactivos = await SwapPair.count({
        where: { active: false }
      });

      // Estadísticas de precios
      const priceStats = await SwapPair.findAll({
        attributes: [
          [sequelize.fn('AVG', sequelize.col('currentPrice')), 'precioPromedio'],
          [sequelize.fn('MIN', sequelize.col('currentPrice')), 'precioMinimo'],
          [sequelize.fn('MAX', sequelize.col('currentPrice')), 'precioMaximo']
        ],
        where: { active: true },
        raw: true
      });

      // Estadísticas de volumen
      const volumeStats = await SwapPair.findAll({
        attributes: [
          [sequelize.fn('SUM', sequelize.col('volume24h')), 'volumenTotal'],
          [sequelize.fn('AVG', sequelize.col('volume24h')), 'volumenPromedio'],
          [sequelize.fn('MAX', sequelize.col('volume24h')), 'volumenMaximo']
        ],
        where: { 
          active: true,
          volume24h: { [Op.gt]: 0 }
        },
        raw: true
      });

      // Estadísticas de comisiones
      const commissionStats = await SwapPair.findAll({
        attributes: [
          [sequelize.fn('AVG', sequelize.col('feePercent')), 'comisionPromedio'],
          [sequelize.fn('MIN', sequelize.col('feePercent')), 'comisionMinima'],
          [sequelize.fn('MAX', sequelize.col('feePercent')), 'comisionMaxima']
        ],
        where: { active: true },
        raw: true
      });

      // Distribución por fuente de precios
      const sourceDistribution = await SwapPair.findAll({
        attributes: [
          'priceSource',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: { active: true },
        group: ['priceSource'],
        raw: true
      });

      // Pares más populares (por cripto base)
      const paresPorBase = await SwapPair.findAll({
        attributes: [
          'baseCryptoId',
          [sequelize.fn('COUNT', sequelize.col('baseCryptoId')), 'count'],
          [sequelize.fn('SUM', sequelize.col('volume24h')), 'volumenTotal']
        ],
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'baseCrypto',
            attributes: ['symbol', 'name']
          }
        ],
        where: { active: true },
        group: ['baseCryptoId', 'baseCrypto.id'],
        order: [[sequelize.fn('SUM', sequelize.col('volume24h')), 'DESC']],
        limit: 10,
        raw: false
      });

      // Pares más populares (por cripto quote)
      const paresPorQuote = await SwapPair.findAll({
        attributes: [
          'quoteCryptoId',
          [sequelize.fn('COUNT', sequelize.col('quoteCryptoId')), 'count'],
          [sequelize.fn('SUM', sequelize.col('volume24h')), 'volumenTotal']
        ],
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'quoteCrypto',
            attributes: ['symbol', 'name']
          }
        ],
        where: { active: true },
        group: ['quoteCryptoId', 'quoteCrypto.id'],
        order: [[sequelize.fn('SUM', sequelize.col('volume24h')), 'DESC']],
        limit: 10,
        raw: false
      });

      // Cambios de price (ganadores y perdedores)
      const gainersLosers = await SwapPair.findAll({
        where: { 
          active: true,
          changePercent24h: { [Op.ne]: null }
        },
        attributes: ['id', 'changePercent24h'],
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'baseCrypto',
            attributes: ['symbol']
          },
          {
            model: sequelize.models.Crypto,
            as: 'quoteCrypto',
            attributes: ['symbol']
          }
        ],
        order: [['changePercent24h', 'DESC']],
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
  SwapPair.createPar = async (data) => {
    try {
      // Verificar que no existe ya un par con esas criptomonedas
      const existingPar = await SwapPair.findOne({
        where: { 
          baseCryptoId: data.baseCryptoId,
          quoteCryptoId: data.quoteCryptoId
        }
      });
      
      if (existingPar) {
        throw new Error('Ya existe un par de exchange con esas criptomonedas');
      }

      // Verificar que las criptomonedas son diferentes
      if (data.baseCryptoId === data.quoteCryptoId) {
        throw new Error('La criptomoneda base y quote deben ser diferentes');
      }

      // Verificar que las criptomonedas existen
      const baseCrypto = await sequelize.models.Crypto.findByPk(data.baseCryptoId);
      const quoteCrypto = await sequelize.models.Crypto.findByPk(data.quoteCryptoId);
      
      if (!baseCrypto || !quoteCrypto) {
        throw new Error('Una o ambas criptomonedas no existen');
      }

      // Datos por defecto mejorados
      const createData = {
        ...data,
        lastUpdated: new Date(),
        priceSource: data.priceSource || 'manual',
        volume24h: data.volume24h || 0,
        volumeBase24h: data.volumeBase24h || 0,
        operationsCount24h: data.operationsCount24h || 0,
        changePercent24h: data.changePercent24h || 0
      };

      const nuevoPar = await SwapPair.create(createData);
      
      return await SwapPair.getById(nuevoPar.id);
    } catch (error) {
      throw new Error(`Error al crear par de exchange: ${error.message}`);
    }
  };

  SwapPair.updatePar = async (id, data) => {
    try {
      // Si se están actualizando las criptomonedas, verificar que no exista otro par igual
      if (data.baseCryptoId || data.quoteCryptoId) {
        const currentPar = await SwapPair.findByPk(id);
        if (!currentPar) {
          throw new Error('Par de exchange no encontrado');
        }

        const newBaseId = data.baseCryptoId || currentPar.baseCryptoId;
        const newQuoteId = data.quoteCryptoId || currentPar.quoteCryptoId;

        if (newBaseId === newQuoteId) {
          throw new Error('La criptomoneda base y quote deben ser diferentes');
        }

        const existingPar = await SwapPair.findOne({
          where: { 
            baseCryptoId: newBaseId,
            quoteCryptoId: newQuoteId,
            id: { [Op.ne]: id }
          }
        });
        
        if (existingPar) {
          throw new Error('Ya existe un par de exchange con esas criptomonedas');
        }
      }

      // Calcular cambio de price si se actualiza el price
      if (data.currentPrice) {
        const currentPar = await SwapPair.findByPk(id);
        if (currentPar && currentPar.currentPrice) {
          data.previousPrice = currentPar.currentPrice;
          data.changePercent24h = ((data.currentPrice - currentPar.currentPrice) / currentPar.currentPrice) * 100;
        }
      }

      const [updatedRowsCount] = await SwapPair.update({
        ...data,
        ...(data.currentPrice && { lastUpdated: new Date() })
      }, {
        where: { id },
        returning: true
      });
      
      if (updatedRowsCount === 0) {
        throw new Error('Par de exchange no encontrado');
      }
      
      const updatedPar = await SwapPair.getById(id);
      return updatedPar;
    } catch (error) {
      throw new Error(`Error al actualizar par de exchange: ${error.message}`);
    }
  };

  SwapPair.deletePar = async (id) => {
    try {
      const deletedRowsCount = await SwapPair.destroy({
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

  // Métodos de gestión de status y precios
  SwapPair.updateStatus = async (id, newStatus) => {
    try {
      const updated = await SwapPair.updatePar(id, { active: newStatus });
      return updated;
    } catch (error) {
      throw new Error(`Error al actualizar status: ${error.message}`);
    }
  };

  SwapPair.updatePrice = async (id, nuevoPrecio) => {
    try {
      if (nuevoPrecio <= 0) {
        throw new Error('El price debe ser mayor a 0');
      }

      const updated = await SwapPair.updatePar(id, {
        currentPrice: String(nuevoPrecio),
        lastUpdated: new Date()
      });
      return updated;
    } catch (error) {
      throw new Error(`Error al actualizar price: ${error.message}`);
    }
  };

  SwapPair.updateCommission = async (id, nuevaComision) => {
    try {
      if (nuevaComision < 0 || nuevaComision > 100) {
        throw new Error('La comisión debe estar entre 0 y 100%');
      }

      const updated = await SwapPair.updatePar(id, {
        feePercent: String(nuevaComision)
      });
      return updated;
    } catch (error) {
      throw new Error(`Error al actualizar comisión: ${error.message}`);
    }
  };

  // Métodos para cálculos de exchange MEJORADOS
  SwapPair.calculateExchange = async (pairId, baseAmount, direction = 'buy') => {
    try {
      const par = await SwapPair.getById(pairId);
      if (!par || !par.active) {
        throw new Error('Par de exchange no encontrado o inactivo');
      }

      // Verificar que el price no esté muy desactualizado
      const ahora = new Date();
      const lastUpdated = new Date(par.lastUpdated);
      const minutosDesdeActualizacion = (ahora - lastUpdated) / (1000 * 60);

      if (minutosDesdeActualizacion > 10 && par.priceSource !== 'manual') {
        console.warn(`Precio desactualizado para el par ${par.baseCrypto.symbol}/${par.quoteCrypto.symbol}`);
      }

      const cantidad = parseFloat(baseAmount);
      const price = parseFloat(par.currentPrice);
      const comision = parseFloat(par.feePercent);

      // Validar límites de cantidad
      const minAmount = 0.00000001;
      const maxAmount = 1000000;

      if (cantidad < minAmount || cantidad > maxAmount) {
        throw new Error(`La cantidad debe estar entre ${minAmount} y ${maxAmount}`);
      }

      let quoteAmount, feeAmount, finalAmount, impactoSlippage = 0;

      if (direction === 'buy') {
        // Comprar base con quote
        quoteAmount = cantidad * price;
        feeAmount = quoteAmount * (comision / 100);
        finalAmount = quoteAmount + feeAmount;
        
        // Simular slippage básico para órdenes grandes
        if (par.volume24h > 0) {
          const porcentajeVolumen = quoteAmount / par.volume24h;
          if (porcentajeVolumen > 0.01) { // Si es más del 1% del volumen diario
            impactoSlippage = Math.min(porcentajeVolumen * 0.5, 0.05); // Max 5% slippage
          }
        }
      } else {
        // Vender base por quote
        quoteAmount = cantidad * price;
        feeAmount = quoteAmount * (comision / 100);
        finalAmount = quoteAmount - feeAmount;
        
        // Simular slippage para ventas
        if (par.volume24h > 0) {
          const porcentajeVolumen = quoteAmount / par.volume24h;
          if (porcentajeVolumen > 0.01) {
            impactoSlippage = Math.min(porcentajeVolumen * 0.5, 0.05);
            finalAmount = finalAmount * (1 - impactoSlippage);
          }
        }
      }

      return {
        par: {
          base: par.baseCrypto.symbol,
          quote: par.quoteCrypto.symbol,
          price: price,
          volume24h: par.volume24h,
          lastUpdated: par.lastUpdated
        },
        calculo: {
          baseAmount: cantidad,
          quoteAmount: quoteAmount,
          feePercent: comision,
          feeAmount: feeAmount,
          impactoSlippage: impactoSlippage,
          finalAmount: finalAmount,
          direccion: direction,
          precioEfectivo: finalAmount / cantidad
        },
        advertencias: minutosDesdeActualizacion > 10 ? 
          [`Precio con ${Math.round(minutosDesdeActualizacion)} minutos de antigüedad`] : []
      };
    } catch (error) {
      throw new Error(`Error al calcular exchange: ${error.message}`);
    }
  };

  // Método para actualización masiva de precios MEJORADO
  SwapPair.bulkUpdatePrices = async (pricesData) => {
    try {
      const results = [];
      
      for (const priceData of pricesData) {
        try {
          const { baseSymbol, quoteSymbol, price, volume, change } = priceData;
          const par = await SwapPair.getBySymbols(baseSymbol, quoteSymbol);
          
          if (par && par.active) {
            const updateData = {
              currentPrice: String(price),
              lastUpdated: new Date()
            };

            if (volume !== undefined) {
              updateData.volume24h = String(volume);
            }

            if (change !== undefined) {
              updateData.changePercent24h = String(change);
            }

            const updated = await SwapPair.updatePar(par.id, updateData);
            results.push({
              par: `${baseSymbol}/${quoteSymbol}`,
              success: true,
              newPrice: price,
              volume: volume,
              change: change,
              updatedAt: updated.lastUpdated
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
  SwapPair.getRealisticOrderBook = async (pairId, depth = 10) => {
    try {
      const par = await SwapPair.getById(pairId);
      
      if (!par || !par.active) {
        throw new Error('Par de exchange no encontrado o inactivo');
      }

      const precioBase = parseFloat(par.currentPrice);
      const volumenBase = parseFloat(par.volume24h) || 100000;
      
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
          price: parseFloat(bidPrice.toFixed(8)),
          cantidad: parseFloat(bidQuantity.toFixed(8)),
          total: parseFloat((bidPrice * bidQuantity).toFixed(8))
        });
        
        // Asks (órdenes de venta)
        const askPrice = precioBase * (1 + factor);
        const askQuantity = (volumenBase / 24) * volumeFactor * Math.random();
        asks.push({
          price: parseFloat(askPrice.toFixed(8)),
          cantidad: parseFloat(askQuantity.toFixed(8)),
          total: parseFloat((askPrice * askQuantity).toFixed(8))
        });
      }

      const bestBid = Math.max(...bids.map(b => b.price));
      const bestAsk = Math.min(...asks.map(a => a.price));
      
      return {
        par: {
          id: par.id,
          base: par.baseCrypto.symbol,
          quote: par.quoteCrypto.symbol,
          currentPrice: precioBase,
          volume24h: par.volume24h,
          lastUpdated: par.lastUpdated
        },
        libro: {
          bids: bids.sort((a, b) => b.price - a.price),
          asks: asks.sort((a, b) => a.price - b.price)
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

  return SwapPair;
}

module.exports = createParExchangeModel;