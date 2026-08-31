// models/walletMaestra.model.js
const initWalletMaestra = require('./entities/walletMaestra.entity');
const { Op, Transaction } = require('sequelize');
const crypto = require('crypto');
const money = require('../utils/money');

function createWalletMaestraModel(sequelize) {
  const WalletMaestra = initWalletMaestra(sequelize);

  // =================== MÉTODOS DE CONSULTA BÁSICOS ===================
  
  WalletMaestra.getById = async (id) => {
    try {
      // 🔍 DEBUG: Verificar qué modelos están disponibles
      console.log('Modelos disponibles:', Object.keys(sequelize.models));
      console.log('¿Existe Criptomoneda?', !!sequelize.models.Criptomoneda);
      console.log('¿Existe DireccionDeposito?', !!sequelize.models.DireccionDeposito);
      console.log('¿Existe User?', !!sequelize.models.Usuario);

      const wallet = await WalletMaestra.findByPk(id, {
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'red', 'decimales', 'activa']
          },
          {
            model: sequelize.models.DireccionDeposito,
            as: 'direccionesDeposito',
            attributes: ['id', 'userId', 'direccion', 'derivationIndex', 'activa', 'created_at'],
            include: [
              {
                model: sequelize.models.Usuario,
                as: 'usuario',
                attributes: ['id', 'email', 'username']
              }
            ]
          }
        ]
      });
      return wallet;
    } catch (error) {
      throw new Error(`Error al obtener wallet maestra por ID: ${error.message}`);
    }
  };

  WalletMaestra.getAll = async (filters = {}) => {
    try {
      const whereClause = {};
      const includeClause = [
        {
          model: sequelize.models.Criptomoneda,
          as: 'criptomoneda',
          attributes: ['id', 'symbol', 'nombre', 'red', 'activa']
        }
      ];
      
      // Filtros básicos
      if (filters.criptomonedaId) {
        whereClause.criptomonedaId = filters.criptomonedaId;
      }
      
      if (filters.activa !== undefined) {
        whereClause.activa = filters.activa === 'true';
      }

      if (filters.red) {
        whereClause.red = filters.red.toLowerCase();
      }

      if (filters.symbol) {
        whereClause.symbol = filters.symbol.toUpperCase();
      }

      if (filters.direccionPublica) {
        whereClause.direccionPublica = {
          [Op.iLike]: `%${filters.direccionPublica}%`
        };
      }

      if (filters.xpub) {
        whereClause.xpub = {
          [Op.iLike]: `%${filters.xpub}%`
        };
      }

      // Filtros por balance
      if (filters.balanceMin !== undefined) {
        whereClause.balanceTotal = {
          ...whereClause.balanceTotal,
          [Op.gte]: parseFloat(filters.balanceMin)
        };
      }

      if (filters.balanceMax !== undefined) {
        whereClause.balanceTotal = {
          ...whereClause.balanceTotal,
          [Op.lte]: parseFloat(filters.balanceMax)
        };
      }

      // Filtros por fechas
      if (filters.fechaDesde || filters.fechaHasta) {
        whereClause.created_at = {};
        if (filters.fechaDesde) {
          whereClause.created_at[Op.gte] = new Date(filters.fechaDesde);
        }
        if (filters.fechaHasta) {
          whereClause.created_at[Op.lte] = new Date(filters.fechaHasta);
        }
      }

      // Paginación
      const limit = parseInt(filters.limit) || 100;
      const offset = parseInt(filters.offset) || 0;

      const { count, rows } = await WalletMaestra.findAndCountAll({
        where: whereClause,
        include: includeClause,
        order: [
          ['balance_total', 'DESC'],
          ['created_at', 'DESC']
        ],
        limit,
        offset
      });
      
      return {
        wallets: rows,
        total: count,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(count / limit),
        limit
      };
    } catch (error) {
      throw new Error(`Error al obtener wallets maestras: ${error.message}`);
    }
  };

  WalletMaestra.search = async (term, limit = 10) => {
    try {
      const wallets = await WalletMaestra.findAll({
        where: {
          [Op.or]: [
            { nombre: { [Op.iLike]: `%${term}%` } },
            { direccionPublica: { [Op.iLike]: `%${term}%` } },
            { symbol: { [Op.iLike]: `%${term}%` } },
            { red: { [Op.iLike]: `%${term}%` } }
          ]
        },
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'red']
          }
        ],
        limit: parseInt(limit),
        order: [['balance_total', 'DESC']]
      });
      
      return wallets;
    } catch (error) {
      throw new Error(`Error en búsqueda de wallets maestras: ${error.message}`);
    }
  };

  // =================== MÉTODOS ESPECÍFICOS PARA HD WALLETS ===================

  WalletMaestra.getByCriptomoneda = async (criptomonedaId) => {
    try {
      const wallet = await WalletMaestra.findOne({
        where: { criptomonedaId: criptomonedaId },
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            // NOTE: no 'derivationPath' / 'addressFormat' — those are NOT columns
            // on Criptomoneda (the HD derivation path lives on WalletMaestra).
            // Selecting them made Postgres throw "column criptomoneda.derivationPath
            // does not exist" on every call, breaking deposit-address provisioning.
            attributes: ['id', 'symbol', 'nombre', 'red', 'decimales']
          },
          {
            model: sequelize.models.DireccionDeposito,
            as: 'direccionesDeposito',
            attributes: ['id', 'userId', 'direccion', 'derivationIndex', 'activa'],
            where: { activa: true },
            required: false,
            include: [
              {
                model: sequelize.models.Usuario,
                as: 'usuario',
                attributes: ['id', 'email', 'username']
              }
            ],
            separate: true,
            limit: 5
          }
        ]
      });
      return wallet;
    } catch (error) {
      throw new Error(`Error al obtener wallet por criptomoneda: ${error.message}`);
    }
  };

  WalletMaestra.getByAddress = async (direccionPublica) => {
    try {
      const wallet = await WalletMaestra.findOne({
        where: { direccionPublica: direccionPublica },
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'red']
          }
        ]
      });
      return wallet;
    } catch (error) {
      throw new Error(`Error al obtener wallet por dirección: ${error.message}`);
    }
  };

  WalletMaestra.getByXpub = async (xpub) => {
    try {
      const wallet = await WalletMaestra.findOne({
        where: { xpub: xpub },
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'red']
          }
        ]
      });
      return wallet;
    } catch (error) {
      throw new Error(`Error al obtener wallet por XPUB: ${error.message}`);
    }
  };

  WalletMaestra.getActive = async (options = {}) => {
    try {
      const whereClause = { activa: true };
      
      if (options.red) {
        whereClause.red = options.red;
      }

      const wallets = await WalletMaestra.findAll({
        where: whereClause,
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'red', 'activa'],
            where: options.soloActivasCrypto !== false ? { activa: true } : undefined
          }
        ],
        order: [['balance_total', 'DESC']]
      });
      return wallets;
    } catch (error) {
      throw new Error(`Error al obtener wallets activas: ${error.message}`);
    }
  };

  WalletMaestra.getWithLowBalance = async (threshold = 0.01) => {
    try {
      const wallets = await WalletMaestra.findAll({
        where: {
          balanceTotal: { [Op.lt]: threshold },
          activa: true
        },
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'red']
          }
        ],
        order: [['balance_total', 'ASC']]
      });
      return wallets;
    } catch (error) {
      throw new Error(`Error al obtener wallets con balance bajo: ${error.message}`);
    }
  };

  WalletMaestra.getWithHighBalance = async (threshold = 100) => {
    try {
      const wallets = await WalletMaestra.findAll({
        where: {
          balanceTotal: { [Op.gte]: threshold },
          activa: true
        },
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'red']
          }
        ],
        order: [['balance_total', 'DESC']]
      });
      return wallets;
    } catch (error) {
      throw new Error(`Error al obtener wallets con balance alto: ${error.message}`);
    }
  };

  // =================== MÉTODOS DE BALANCE Y TRANSACCIONES ===================

  // `transaction` es opcional: si el caller ya tiene una abierta (ej.
  // createOrder) hay que sumarse a ella, no abrir una propia — antes esta
  // función siempre abría y commiteaba la suya, así que un addToBalance()
  // llamado desde dentro de otra transacción quedaba confirmado en la DB
  // aunque esa transacción externa después hiciera rollback.
  WalletMaestra.updateBalance = async (id, nuevoBalance, transaction = null) => {
    const ownTransaction = !transaction;
    const t = transaction || await sequelize.transaction();

    try {
      const wallet = await WalletMaestra.findByPk(id, { transaction: t });

      if (!wallet) {
        throw new Error('Wallet maestra no encontrada');
      }

      const balanceAnterior = String(wallet.balanceTotal);

      await WalletMaestra.update(
        {
          balanceTotal: nuevoBalance,
          lastSyncAt: new Date(),
          metadata: {
            ...wallet.metadata,
            lastBalanceUpdate: new Date(),
            previousBalance: balanceAnterior,
            balanceChange: money.subtract(String(nuevoBalance), balanceAnterior)
          }
        },
        {
          where: { id },
          transaction: t
        }
      );

      if (ownTransaction) {
        await t.commit();
        return await WalletMaestra.getById(id);
      }

      // Dentro de una transacción compartida todavía sin commitear: devolver
      // el estado en memoria en vez de releerlo (una lectura aparte podría no
      // ver el cambio todavía, según el nivel de aislamiento).
      wallet.balanceTotal = nuevoBalance;
      return wallet;
    } catch (error) {
      if (ownTransaction) await t.rollback();
      throw new Error(`Error al actualizar balance: ${error.message}`);
    }
  };

  WalletMaestra.addToBalance = async (id, cantidad, transaction = null) => {
    try {
      const wallet = await WalletMaestra.findByPk(id, { transaction });
      if (!wallet) {
        throw new Error('Wallet maestra no encontrada');
      }

      const nuevoBalance = money.add(String(wallet.balanceTotal), String(cantidad));

      if (money.compare(nuevoBalance, '0') < 0) {
        throw new Error('El balance resultante no puede ser negativo');
      }

      return await WalletMaestra.updateBalance(id, nuevoBalance, transaction);
    } catch (error) {
      throw new Error(`Error al sumar al balance: ${error.message}`);
    }
  };

  WalletMaestra.subtractFromBalance = async (id, cantidad, transaction = null) => {
    try {
      const wallet = await WalletMaestra.findByPk(id, { transaction });
      if (!wallet) {
        throw new Error('Wallet maestra no encontrada');
      }

      const nuevoBalance = money.subtract(String(wallet.balanceTotal), String(cantidad));

      if (money.compare(nuevoBalance, '0') < 0) {
        throw new Error('Balance insuficiente para realizar la operación');
      }

      return await WalletMaestra.updateBalance(id, nuevoBalance, transaction);
    } catch (error) {
      throw new Error(`Error al restar del balance: ${error.message}`);
    }
  };

  WalletMaestra.getBalanceSummary = async (options = {}) => {
    try {
      const whereClause = { activa: true };
      
      if (options.red) {
        whereClause.red = options.red;
      }

      if (options.fechaDesde) {
        whereClause.lastSyncAt = {
          [Op.gte]: new Date(options.fechaDesde)
        };
      }

      const summary = await WalletMaestra.findAll({
        attributes: [
          'red',
          'symbol',
          [sequelize.fn('COUNT', sequelize.col('WalletMaestra.id')), 'walletCount'],
          [sequelize.fn('SUM', sequelize.col('balance_total')), 'totalBalance'],
          [sequelize.fn('AVG', sequelize.col('balance_total')), 'averageBalance'],
          [sequelize.fn('MAX', sequelize.col('balance_total')), 'maxBalance'],
          [sequelize.fn('MIN', sequelize.col('balance_total')), 'minBalance']
        ],
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['symbol', 'nombre', 'red', 'decimales']
          }
        ],
        where: whereClause,
        group: ['WalletMaestra.red', 'WalletMaestra.symbol', 'criptomoneda.id'],
        order: [[sequelize.fn('SUM', sequelize.col('balance_total')), 'DESC']],
        raw: false
      });

      return summary;
    } catch (error) {
      throw new Error(`Error al obtener resumen de balances: ${error.message}`);
    }
  };

  // =================== MÉTODOS DE ESTADÍSTICAS AVANZADAS ===================

  WalletMaestra.getStats = async (filters = {}) => {
    try {
      const baseWhere = {};
      
      if (filters.fechaDesde || filters.fechaHasta) {
        baseWhere.created_at = {};
        if (filters.fechaDesde) {
          baseWhere.created_at[Op.gte] = new Date(filters.fechaDesde);
        }
        if (filters.fechaHasta) {
          baseWhere.created_at[Op.lte] = new Date(filters.fechaHasta);
        }
      }

      const totalWallets = await WalletMaestra.count({ where: baseWhere });
      const walletsActivas = await WalletMaestra.count({
        where: { ...baseWhere, activa: true }
      });
      const walletsInactivas = await WalletMaestra.count({
        where: { ...baseWhere, activa: false }
      });

      // Balance total por red
      const balancesPorRed = await WalletMaestra.findAll({
        attributes: [
          'red',
          [sequelize.fn('COUNT', sequelize.col('id')), 'walletCount'],
          [sequelize.fn('SUM', sequelize.col('balance_total')), 'totalBalance']
        ],
        where: { ...baseWhere, activa: true },
        group: ['red'],
        order: [[sequelize.fn('SUM', sequelize.col('balance_total')), 'DESC']],
        raw: true
      });

      // Direcciones generadas por wallet - CONSULTA CORREGIDA CON RAW SQL
      const direccionesPorWallet = await sequelize.query(`
        SELECT 
          wm.id,
          wm.nombre,
          wm.symbol,
          COUNT(dd.id) as "direccionesCount"
        FROM wallets_maestras wm
        LEFT JOIN direcciones_deposito dd ON wm.id = dd.wallet_maestra_id
        WHERE wm.id IS NOT NULL
        ${filters.fechaDesde ? `AND wm.created_at >= '${new Date(filters.fechaDesde).toISOString()}'` : ''}
        ${filters.fechaHasta ? `AND wm.created_at <= '${new Date(filters.fechaHasta).toISOString()}'` : ''}
        GROUP BY wm.id, wm.nombre, wm.symbol
        ORDER BY COUNT(dd.id) DESC
        LIMIT 10
      `, {
        type: sequelize.QueryTypes.SELECT
      });

      // Wallets que necesitan atención
      const walletsBalanceBajo = await WalletMaestra.count({
        where: {
          ...baseWhere,
          balanceTotal: { [Op.lt]: 0.1 },
          activa: true
        }
      });

      // Wallets sin sincronización reciente
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const walletsSinSincronizar = await WalletMaestra.count({
        where: {
          ...baseWhere,
          activa: true,
          [Op.or]: [
            { lastSyncAt: null },
            { lastSyncAt: { [Op.lt]: sevenDaysAgo } }
          ]
        }
      });

      return {
        resumen: {
          total: totalWallets,
          activas: walletsActivas,
          inactivas: walletsInactivas,
          porcentajeActivas: totalWallets > 0 ? ((walletsActivas / totalWallets) * 100).toFixed(2) : 0
        },
        balancesPorRed,
        direccionesPorWallet,
        alertas: {
          walletsBalanceBajo,
          walletsSinSincronizar
        }
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  };

  // =================== MÉTODOS CRUD CON VALIDACIÓN HD ===================

  WalletMaestra.createWallet = async (data) => {
    const transaction = await sequelize.transaction();
    
    try {
      // Validaciones previas
      if (!data.xpub) {
        throw new Error('XPUB es requerido para crear una wallet maestra');
      }

      // Verificar unicidad de criptomoneda
      const existingWallet = await WalletMaestra.findOne({
        where: { criptomonedaId: data.criptomonedaId },
        transaction
      });
      
      if (existingWallet) {
        throw new Error('Ya existe una wallet maestra para esta criptomoneda');
      }

      // Verificar unicidad de XPUB
      const existingXpub = await WalletMaestra.findOne({
        where: { xpub: data.xpub },
        transaction
      });
      
      if (existingXpub) {
        throw new Error('Esta XPUB ya está en uso');
      }

      // Verificar que la criptomoneda existe
      const criptomoneda = await sequelize.models.Criptomoneda.findByPk(data.criptomonedaId, {
        transaction
      });
      
      if (!criptomoneda) {
        throw new Error('Criptomoneda no encontrada');
      }

      // Completar datos faltantes
      const walletData = {
        ...data,
        red: data.red || criptomoneda.red,
        symbol: data.symbol || criptomoneda.symbol,
        derivationPath: data.derivationPath || criptomoneda.derivationPath || "m/44'/0'/0'",
        nextDerivationIndex: 0,
        metadata: {
          ...data.metadata,
          createdAt: new Date(),
          method: 'manual_creation'
        }
      };

      const nuevaWallet = await WalletMaestra.create(walletData, { transaction });
      await transaction.commit();
      
      return await WalletMaestra.getById(nuevaWallet.id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al crear wallet maestra: ${error.message}`);
    }
  };

  WalletMaestra.updateWallet = async (id, data) => {
    const transaction = await sequelize.transaction();
    
    try {
      const wallet = await WalletMaestra.findByPk(id, { transaction });
      
      if (!wallet) {
        throw new Error('Wallet maestra no encontrada');
      }

      // Validar cambio de criptomoneda
      if (data.criptomonedaId && data.criptomonedaId !== wallet.criptomonedaId) {
        const existingWallet = await WalletMaestra.findOne({
          where: { 
            criptomonedaId: data.criptomonedaId,
            id: { [Op.ne]: id }
          },
          transaction
        });
        
        if (existingWallet) {
          throw new Error('Ya existe una wallet maestra para esta criptomoneda');
        }
      }

      // Validar cambio de XPUB
      if (data.xpub && data.xpub !== wallet.xpub) {
        const existingXpub = await WalletMaestra.findOne({
          where: { 
            xpub: data.xpub,
            id: { [Op.ne]: id }
          },
          transaction
        });
        
        if (existingXpub) {
          throw new Error('Esta XPUB ya está en uso');
        }
      }

      // Preparar datos de actualización
      const updateData = {
        ...data,
        metadata: {
          ...wallet.metadata,
          ...data.metadata,
          lastModified: new Date()
        }
      };

      await WalletMaestra.update(updateData, {
        where: { id },
        transaction
      });
      
      await transaction.commit();
      
      return await WalletMaestra.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al actualizar wallet maestra: ${error.message}`);
    }
  };

  WalletMaestra.deleteWallet = async (id) => {
    const transaction = await sequelize.transaction();
    
    try {
      // Verificar que no tiene direcciones de depósito activas
      const direccionesActivas = await sequelize.models.DireccionDeposito.count({
        where: { 
          walletMaestraId: id,
          activa: true
        },
        transaction
      });

      if (direccionesActivas > 0) {
        throw new Error(`No se puede eliminar: la wallet tiene ${direccionesActivas} direcciones de depósito activas`);
      }

      const deletedRowsCount = await WalletMaestra.destroy({
        where: { id },
        transaction
      });
      
      if (deletedRowsCount === 0) {
        throw new Error('Wallet maestra no encontrada');
      }
      
      await transaction.commit();
      
      return { 
        message: 'Wallet maestra eliminada correctamente',
        direccionesAfectadas: direccionesActivas
      };
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al eliminar wallet maestra: ${error.message}`);
    }
  };

  // =================== MÉTODOS DE GESTIÓN DE ESTADO ===================

  WalletMaestra.updateStatus = async (id, newStatus, reason = null) => {
    const transaction = await sequelize.transaction();
    
    try {
      const wallet = await WalletMaestra.findByPk(id, { transaction });
      
      if (!wallet) {
        throw new Error('Wallet maestra no encontrada');
      }

      // Si se desactiva, también desactivar direcciones asociadas
      if (!newStatus && wallet.activa) {
        await sequelize.models.DireccionDeposito.update(
          { 
            activa: false,
            metadata: sequelize.literal(`
              metadata || '{"deactivatedReason": "wallet_maestra_deactivated", "deactivatedAt": "${new Date().toISOString()}"}'::jsonb
            `)
          },
          { 
            where: { walletMaestraId: id },
            transaction
          }
        );
      }

      const updateData = { 
        activa: newStatus,
        metadata: {
          ...wallet.metadata,
          lastStatusChange: new Date(),
          statusChangeReason: reason
        }
      };

      await WalletMaestra.update(updateData, {
        where: { id },
        transaction
      });
      
      await transaction.commit();
      
      return await WalletMaestra.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al actualizar estado: ${error.message}`);
    }
  };

  // =================== MÉTODOS DE SINCRONIZACIÓN CON BLOCKCHAIN ===================

  WalletMaestra.syncBalance = async (id, blockchainBalance) => {
    try {
      const wallet = await WalletMaestra.findByPk(id);
      if (!wallet) {
        throw new Error('Wallet maestra no encontrada');
      }

      const currentBalance = String(wallet.balanceTotal);
      const newBalance = String(blockchainBalance);
      const tolerance = '0.00000001'; // Tolerancia para diferencias mínimas

      const difference = money.subtract(newBalance, currentBalance);
      const absDifference = money.compare(difference, '0') < 0
        ? money.multiply(difference, '-1')
        : difference;

      if (money.compare(absDifference, tolerance) > 0) {
        const updated = await WalletMaestra.updateBalance(id, newBalance);

        return {
          synchronized: true,
          previousBalance: currentBalance,
          newBalance: newBalance,
          difference: difference,
          wallet: updated
        };
      }

      // Actualizar solo timestamp de sincronización
      await WalletMaestra.update(
        { lastSyncAt: new Date() },
        { where: { id } }
      );

      return {
        synchronized: false,
        message: 'Balance ya está sincronizado',
        currentBalance: currentBalance,
        blockchainBalance: newBalance
      };
    } catch (error) {
      throw new Error(`Error al sincronizar balance: ${error.message}`);
    }
  };

  WalletMaestra.syncAllBalances = async (balancesData) => {
    const transaction = await sequelize.transaction();
    
    try {
      const results = [];
      
      for (const balanceData of balancesData) {
        try {
          let wallet = null;
          
          // Buscar por dirección o XPUB
          if (balanceData.address) {
            wallet = await WalletMaestra.getByAddress(balanceData.address);
          } else if (balanceData.xpub) {
            wallet = await WalletMaestra.getByXpub(balanceData.xpub);
          }
          
          if (wallet) {
            const syncResult = await WalletMaestra.syncBalance(wallet.id, balanceData.balance);
            results.push({
              walletId: wallet.id,
              criptomoneda: wallet.criptomoneda?.symbol || wallet.symbol,
              ...syncResult
            });
          } else {
            results.push({
              address: balanceData.address || balanceData.xpub,
              error: 'Wallet no encontrada'
            });
          }
        } catch (error) {
          results.push({
            address: balanceData.address || balanceData.xpub,
            error: error.message
          });
        }
      }

      await transaction.commit();

      return {
        totalProcessed: balancesData.length,
        synchronized: results.filter(r => r.synchronized).length,
        errors: results.filter(r => r.error).length,
        results: results
      };
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al sincronizar todos los balances: ${error.message}`);
    }
  };

  // =================== MÉTODOS DE ANÁLISIS Y REPORTES ===================

  WalletMaestra.getFundsDistribution = async () => {
    try {
      const distribution = await WalletMaestra.findAll({
        attributes: [
          'id',
          'nombre',
          'symbol',
          'red',
          'balanceTotal',
          'direccionPublica',
          [
            sequelize.literal(`
              ROUND(
                (balance_total / NULLIF((SELECT SUM(balance_total) FROM wallets_maestras WHERE activa = true), 0)) * 100, 
                4
              )
            `),
            'percentage'
          ]
        ],
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['symbol', 'nombre', 'red', 'decimales']
          }
        ],
        where: { activa: true },
        order: [['balance_total', 'DESC']],
        raw: false
      });

      return distribution;
    } catch (error) {
      throw new Error(`Error al obtener distribución de fondos: ${error.message}`);
    }
  };

  // =================== MÉTODOS DE UTILIDAD PARA HD WALLETS ===================

  WalletMaestra.incrementDerivationIndex = async (id, transaction = null) => {
    try {
      const wallet = await WalletMaestra.findByPk(id, { transaction });
      
      if (!wallet) {
        throw new Error('Wallet maestra no encontrada');
      }

      const newIndex = wallet.nextDerivationIndex + 1;
      
      await WalletMaestra.update(
        { nextDerivationIndex: newIndex },
        { where: { id }, transaction }
      );

      return wallet.nextDerivationIndex; // Retorna el índice usado
    } catch (error) {
      throw new Error(`Error al incrementar índice de derivación: ${error.message}`);
    }
  };

  WalletMaestra.validateXpubNetwork = (xpub, network) => {
    try {
      switch (network.toLowerCase()) {
        case 'bitcoin':
        case 'btc':
          if (!xpub.startsWith('xpub') && !xpub.startsWith('ypub') && !xpub.startsWith('zpub')) {
            return { valid: false, message: 'XPUB de Bitcoin debe empezar con xpub, ypub o zpub' };
          }
          break;
        case 'ethereum':
        case 'eth':
        case 'bsc':
        case 'polygon':
          if (xpub.startsWith('xpub')) {
            return { valid: false, message: 'XPUB de Ethereum no debe usar formato Bitcoin' };
          }
          break;
        default:
          return { valid: false, message: `Red no soportada: ${network}` };
      }
      
      return { valid: true, message: 'XPUB válido para la red' };
    } catch (error) {
      return { valid: false, message: `Error validando XPUB: ${error.message}` };
    }
  };

  WalletMaestra.getTreasuryMetrics = async (timeframe = '30 days') => {
    try {
      // Calcular fecha de inicio según timeframe
      let startDate = new Date();
      switch (timeframe) {
        case '7 days':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30 days':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90 days':
          startDate.setDate(startDate.getDate() - 90);
          break;
        case '1 year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(startDate.getDate() - 30);
      }

      // Balance total actual
      const balanceSummary = await WalletMaestra.getBalanceSummary();
      const totalValue = balanceSummary.reduce((acc, item) => {
        return acc + parseFloat(item.dataValues.totalBalance || 0);
      }, 0);

      // Distribución por blockchain/red
      const networkDistribution = {};
      for (const balance of balanceSummary) {
        const network = balance.red;
        if (!networkDistribution[network]) {
          networkDistribution[network] = {
            count: 0,
            totalValue: 0,
            currencies: []
          };
        }
        networkDistribution[network].count += parseInt(balance.dataValues.walletCount);
        networkDistribution[network].totalValue += parseFloat(balance.dataValues.totalBalance || 0);
        networkDistribution[network].currencies.push({
          symbol: balance.symbol,
          balance: parseFloat(balance.dataValues.totalBalance || 0)
        });
      }

      // Wallets que requieren atención
      const lowBalanceWallets = await WalletMaestra.getWithLowBalance(0.1);
      const staleSyncWallets = await WalletMaestra.findAll({
        where: {
          activa: true,
          [Op.or]: [
            { lastSyncAt: null },
            { lastSyncAt: { [Op.lt]: startDate } }
          ]
        },
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda'
          }
        ],
        order: [['last_sync_at', 'ASC']]
      });

      return {
        timeframe,
        valorTotalTesoreria: totalValue,
        totalWallets: balanceSummary.length,
        distribucionPorRed: networkDistribution,
        balancesPorCriptomoneda: balanceSummary,
        alertas: {
          walletsBalanceBajo: {
            count: lowBalanceWallets.length,
            threshold: 0.1,
            wallets: lowBalanceWallets.slice(0, 5) // Solo primeras 5
          },
          walletsSinSincronizar: {
            count: staleSyncWallets.length,
            wallets: staleSyncWallets.slice(0, 5) // Solo primeras 5
          }
        },
        ultimaActualizacion: new Date()
      };
    } catch (error) {
      throw new Error(`Error al obtener métricas de treasury: ${error.message}`);
    }
  };

  // =================== MÉTODOS DE GENERACIÓN MASIVA ===================

  WalletMaestra.createBulkWallets = async (walletsData) => {
    const transaction = await sequelize.transaction();
    
    try {
      const results = [];
      const errors = [];
      
      for (const walletData of walletsData) {
        try {
          const nuevaWallet = await WalletMaestra.createWallet(walletData);
          results.push(nuevaWallet);
        } catch (error) {
          errors.push({
            walletData: walletData,
            error: error.message
          });
        }
      }

      if (errors.length > 0) {
        await transaction.rollback();
        throw new Error(`Errores en creación masiva: ${JSON.stringify(errors, null, 2)}`);
      }

      await transaction.commit();
      
      return {
        created: results.length,
        wallets: results,
        errors: errors
      };
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error en creación masiva de wallets: ${error.message}`);
    }
  };

  return WalletMaestra;
}

module.exports = createWalletMaestraModel;