// models/walletMaestra.model.js
const initWalletMaestra = require('./masterWallet.entity');
const { Op, Transaction } = require('sequelize');
const crypto = require('crypto');
const money = require('../../utils/money');

function createWalletMaestraModel(sequelize) {
  const MasterWallet = initWalletMaestra(sequelize);

  // =================== MÉTODOS DE CONSULTA BÁSICOS ===================
  
  MasterWallet.getById = async (id) => {
    try {
      // 🔍 DEBUG: Verificar qué modelos están disponibles
      console.log('Modelos disponibles:', Object.keys(sequelize.models));
      console.log('¿Existe Crypto?', !!sequelize.models.Crypto);
      console.log('¿Existe DepositAddress?', !!sequelize.models.DepositAddress);
      console.log('¿Existe User?', !!sequelize.models.User);

      const wallet = await MasterWallet.findByPk(id, {
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['id', 'symbol', 'name', 'network', 'decimals', 'active']
          },
          {
            model: sequelize.models.DepositAddress,
            as: 'depositAddresses',
            attributes: ['id', 'userId', 'address', 'derivationIndex', 'active', 'created_at'],
            include: [
              {
                model: sequelize.models.User,
                as: 'user',
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

  MasterWallet.getAll = async (filters = {}) => {
    try {
      const whereClause = {};
      const includeClause = [
        {
          model: sequelize.models.Crypto,
          as: 'crypto',
          attributes: ['id', 'symbol', 'name', 'network', 'active']
        }
      ];
      
      // Filtros básicos
      if (filters.cryptoId) {
        whereClause.cryptoId = filters.cryptoId;
      }
      
      if (filters.active !== undefined) {
        whereClause.active = filters.active === 'true';
      }

      if (filters.network) {
        whereClause.network = filters.network.toLowerCase();
      }

      if (filters.symbol) {
        whereClause.symbol = filters.symbol.toUpperCase();
      }

      if (filters.publicAddress) {
        whereClause.publicAddress = {
          [Op.iLike]: `%${filters.publicAddress}%`
        };
      }

      if (filters.xpub) {
        whereClause.xpub = {
          [Op.iLike]: `%${filters.xpub}%`
        };
      }

      // Filtros por balance
      if (filters.balanceMin !== undefined) {
        whereClause.totalBalance = {
          ...whereClause.totalBalance,
          [Op.gte]: parseFloat(filters.balanceMin)
        };
      }

      if (filters.balanceMax !== undefined) {
        whereClause.totalBalance = {
          ...whereClause.totalBalance,
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

      const { count, rows } = await MasterWallet.findAndCountAll({
        where: whereClause,
        include: includeClause,
        order: [
          ['total_balance', 'DESC'],
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

  MasterWallet.search = async (term, limit = 10) => {
    try {
      const wallets = await MasterWallet.findAll({
        where: {
          [Op.or]: [
            { name: { [Op.iLike]: `%${term}%` } },
            { publicAddress: { [Op.iLike]: `%${term}%` } },
            { symbol: { [Op.iLike]: `%${term}%` } },
            { network: { [Op.iLike]: `%${term}%` } }
          ]
        },
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['id', 'symbol', 'name', 'network']
          }
        ],
        limit: parseInt(limit),
        order: [['total_balance', 'DESC']]
      });
      
      return wallets;
    } catch (error) {
      throw new Error(`Error en búsqueda de wallets maestras: ${error.message}`);
    }
  };

  // =================== MÉTODOS ESPECÍFICOS PARA HD WALLETS ===================

  MasterWallet.getByCrypto = async (cryptoId) => {
    try {
      const wallet = await MasterWallet.findOne({
        where: { cryptoId: cryptoId },
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            // NOTE: no 'derivationPath' / 'addressFormat' — those are NOT columns
            // on Crypto (the HD derivation path lives on MasterWallet).
            // Selecting them made Postgres throw "column crypto.derivationPath
            // does not exist" on every call, breaking deposit-address provisioning.
            attributes: ['id', 'symbol', 'name', 'network', 'decimals']
          },
          {
            model: sequelize.models.DepositAddress,
            as: 'depositAddresses',
            attributes: ['id', 'userId', 'address', 'derivationIndex', 'active'],
            where: { active: true },
            required: false,
            include: [
              {
                model: sequelize.models.User,
                as: 'user',
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
      throw new Error(`Error al obtener wallet por crypto: ${error.message}`);
    }
  };

  MasterWallet.getByAddress = async (publicAddress) => {
    try {
      const wallet = await MasterWallet.findOne({
        where: { publicAddress: publicAddress },
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['id', 'symbol', 'name', 'network']
          }
        ]
      });
      return wallet;
    } catch (error) {
      throw new Error(`Error al obtener wallet por dirección: ${error.message}`);
    }
  };

  MasterWallet.getByXpub = async (xpub) => {
    try {
      const wallet = await MasterWallet.findOne({
        where: { xpub: xpub },
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['id', 'symbol', 'name', 'network']
          }
        ]
      });
      return wallet;
    } catch (error) {
      throw new Error(`Error al obtener wallet por XPUB: ${error.message}`);
    }
  };

  MasterWallet.getActive = async (options = {}) => {
    try {
      const whereClause = { active: true };
      
      if (options.network) {
        whereClause.network = options.network;
      }

      const wallets = await MasterWallet.findAll({
        where: whereClause,
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['id', 'symbol', 'name', 'network', 'active'],
            where: options.soloActivasCrypto !== false ? { active: true } : undefined
          }
        ],
        order: [['total_balance', 'DESC']]
      });
      return wallets;
    } catch (error) {
      throw new Error(`Error al obtener wallets activas: ${error.message}`);
    }
  };

  MasterWallet.getWithLowBalance = async (threshold = 0.01) => {
    try {
      const wallets = await MasterWallet.findAll({
        where: {
          totalBalance: { [Op.lt]: threshold },
          active: true
        },
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['id', 'symbol', 'name', 'network']
          }
        ],
        order: [['total_balance', 'ASC']]
      });
      return wallets;
    } catch (error) {
      throw new Error(`Error al obtener wallets con balance bajo: ${error.message}`);
    }
  };

  MasterWallet.getWithHighBalance = async (threshold = 100) => {
    try {
      const wallets = await MasterWallet.findAll({
        where: {
          totalBalance: { [Op.gte]: threshold },
          active: true
        },
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['id', 'symbol', 'name', 'network']
          }
        ],
        order: [['total_balance', 'DESC']]
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
  MasterWallet.updateBalance = async (id, nuevoBalance, transaction = null) => {
    const ownTransaction = !transaction;
    const t = transaction || await sequelize.transaction();

    try {
      const wallet = await MasterWallet.findByPk(id, { transaction: t });

      if (!wallet) {
        throw new Error('Wallet maestra no encontrada');
      }

      const balanceAnterior = String(wallet.totalBalance);

      await MasterWallet.update(
        {
          totalBalance: nuevoBalance,
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
        return await MasterWallet.getById(id);
      }

      // Dentro de una transacción compartida todavía sin commitear: devolver
      // el estado en memoria en vez de releerlo (una lectura aparte podría no
      // ver el cambio todavía, según el nivel de aislamiento).
      wallet.totalBalance = nuevoBalance;
      return wallet;
    } catch (error) {
      if (ownTransaction) await t.rollback();
      throw new Error(`Error al actualizar balance: ${error.message}`);
    }
  };

  MasterWallet.addToBalance = async (id, amount, transaction = null) => {
    try {
      const wallet = await MasterWallet.findByPk(id, { transaction });
      if (!wallet) {
        throw new Error('Wallet maestra no encontrada');
      }

      const nuevoBalance = money.add(String(wallet.totalBalance), String(amount));

      if (money.compare(nuevoBalance, '0') < 0) {
        throw new Error('El balance resultante no puede ser negativo');
      }

      return await MasterWallet.updateBalance(id, nuevoBalance, transaction);
    } catch (error) {
      throw new Error(`Error al sumar al balance: ${error.message}`);
    }
  };

  MasterWallet.subtractFromBalance = async (id, amount, transaction = null) => {
    try {
      const wallet = await MasterWallet.findByPk(id, { transaction });
      if (!wallet) {
        throw new Error('Wallet maestra no encontrada');
      }

      const nuevoBalance = money.subtract(String(wallet.totalBalance), String(amount));

      if (money.compare(nuevoBalance, '0') < 0) {
        throw new Error('Balance insuficiente para realizar la operación');
      }

      return await MasterWallet.updateBalance(id, nuevoBalance, transaction);
    } catch (error) {
      throw new Error(`Error al restar del balance: ${error.message}`);
    }
  };

  MasterWallet.getBalanceSummary = async (options = {}) => {
    try {
      const whereClause = { active: true };
      
      if (options.network) {
        whereClause.network = options.network;
      }

      if (options.fechaDesde) {
        whereClause.lastSyncAt = {
          [Op.gte]: new Date(options.fechaDesde)
        };
      }

      const summary = await MasterWallet.findAll({
        attributes: [
          'network',
          'symbol',
          [sequelize.fn('COUNT', sequelize.col('MasterWallet.id')), 'walletCount'],
          [sequelize.fn('SUM', sequelize.col('total_balance')), 'totalBalance'],
          [sequelize.fn('AVG', sequelize.col('total_balance')), 'averageBalance'],
          [sequelize.fn('MAX', sequelize.col('total_balance')), 'maxBalance'],
          [sequelize.fn('MIN', sequelize.col('total_balance')), 'minBalance']
        ],
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['symbol', 'name', 'network', 'decimals']
          }
        ],
        where: whereClause,
        group: ['MasterWallet.red', 'MasterWallet.symbol', 'criptomoneda.id'],
        order: [[sequelize.fn('SUM', sequelize.col('total_balance')), 'DESC']],
        raw: false
      });

      return summary;
    } catch (error) {
      throw new Error(`Error al obtener resumen de balances: ${error.message}`);
    }
  };

  // =================== MÉTODOS DE ESTADÍSTICAS AVANZADAS ===================

  MasterWallet.getStats = async (filters = {}) => {
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

      const totalWallets = await MasterWallet.count({ where: baseWhere });
      const walletsActivas = await MasterWallet.count({
        where: { ...baseWhere, active: true }
      });
      const walletsInactivas = await MasterWallet.count({
        where: { ...baseWhere, active: false }
      });

      // Balance total por network
      const balancesPorRed = await MasterWallet.findAll({
        attributes: [
          'network',
          [sequelize.fn('COUNT', sequelize.col('id')), 'walletCount'],
          [sequelize.fn('SUM', sequelize.col('total_balance')), 'totalBalance']
        ],
        where: { ...baseWhere, active: true },
        group: ['network'],
        order: [[sequelize.fn('SUM', sequelize.col('total_balance')), 'DESC']],
        raw: true
      });

      // Direcciones generadas por wallet - CONSULTA CORREGIDA CON RAW SQL
      const direccionesPorWallet = await sequelize.query(`
        SELECT 
          wm.id,
          wm.name,
          wm.symbol,
          COUNT(dd.id) as "direccionesCount"
        FROM master_wallets wm
        LEFT JOIN deposit_addresses dd ON wm.id = dd.master_wallet_id
        WHERE wm.id IS NOT NULL
        ${filters.fechaDesde ? `AND wm.created_at >= '${new Date(filters.fechaDesde).toISOString()}'` : ''}
        ${filters.fechaHasta ? `AND wm.created_at <= '${new Date(filters.fechaHasta).toISOString()}'` : ''}
        GROUP BY wm.id, wm.name, wm.symbol
        ORDER BY COUNT(dd.id) DESC
        LIMIT 10
      `, {
        type: sequelize.QueryTypes.SELECT
      });

      // Wallets que necesitan atención
      const walletsBalanceBajo = await MasterWallet.count({
        where: {
          ...baseWhere,
          totalBalance: { [Op.lt]: 0.1 },
          active: true
        }
      });

      // Wallets sin sincronización reciente
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const walletsSinSincronizar = await MasterWallet.count({
        where: {
          ...baseWhere,
          active: true,
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

  MasterWallet.createWallet = async (data) => {
    const transaction = await sequelize.transaction();
    
    try {
      // Validaciones previas
      if (!data.xpub) {
        throw new Error('XPUB es requerido para crear una wallet maestra');
      }

      // Verificar unicidad de crypto
      const existingWallet = await MasterWallet.findOne({
        where: { cryptoId: data.cryptoId },
        transaction
      });
      
      if (existingWallet) {
        throw new Error('Ya existe una wallet maestra para esta criptomoneda');
      }

      // Verificar unicidad de XPUB
      const existingXpub = await MasterWallet.findOne({
        where: { xpub: data.xpub },
        transaction
      });
      
      if (existingXpub) {
        throw new Error('Esta XPUB ya está en uso');
      }

      // Verificar que la criptomoneda existe
      const crypto = await sequelize.models.Crypto.findByPk(data.cryptoId, {
        transaction
      });
      
      if (!crypto) {
        throw new Error('Criptomoneda no encontrada');
      }

      // Completar datos faltantes
      const walletData = {
        ...data,
        network: data.network || crypto.network,
        symbol: data.symbol || crypto.symbol,
        derivationPath: data.derivationPath || crypto.derivationPath || "m/44'/0'/0'",
        nextDerivationIndex: 0,
        metadata: {
          ...data.metadata,
          createdAt: new Date(),
          method: 'manual_creation'
        }
      };

      const nuevaWallet = await MasterWallet.create(walletData, { transaction });
      await transaction.commit();
      
      return await MasterWallet.getById(nuevaWallet.id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al crear wallet maestra: ${error.message}`);
    }
  };

  MasterWallet.updateWallet = async (id, data) => {
    const transaction = await sequelize.transaction();
    
    try {
      const wallet = await MasterWallet.findByPk(id, { transaction });
      
      if (!wallet) {
        throw new Error('Wallet maestra no encontrada');
      }

      // Validar cambio de crypto
      if (data.cryptoId && data.cryptoId !== wallet.cryptoId) {
        const existingWallet = await MasterWallet.findOne({
          where: { 
            cryptoId: data.cryptoId,
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
        const existingXpub = await MasterWallet.findOne({
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

      await MasterWallet.update(updateData, {
        where: { id },
        transaction
      });
      
      await transaction.commit();
      
      return await MasterWallet.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al actualizar wallet maestra: ${error.message}`);
    }
  };

  MasterWallet.deleteWallet = async (id) => {
    const transaction = await sequelize.transaction();
    
    try {
      // Verificar que no tiene direcciones de depósito activas
      const direccionesActivas = await sequelize.models.DepositAddress.count({
        where: { 
          masterWalletId: id,
          active: true
        },
        transaction
      });

      if (direccionesActivas > 0) {
        throw new Error(`No se puede eliminar: la wallet tiene ${direccionesActivas} direcciones de depósito activas`);
      }

      const deletedRowsCount = await MasterWallet.destroy({
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

  MasterWallet.updateStatus = async (id, newStatus, reason = null) => {
    const transaction = await sequelize.transaction();
    
    try {
      const wallet = await MasterWallet.findByPk(id, { transaction });
      
      if (!wallet) {
        throw new Error('Wallet maestra no encontrada');
      }

      // Si se desactiva, también desactivar direcciones asociadas
      if (!newStatus && wallet.active) {
        await sequelize.models.DepositAddress.update(
          { 
            active: false,
            metadata: sequelize.literal(`
              metadata || '{"deactivatedReason": "wallet_maestra_deactivated", "deactivatedAt": "${new Date().toISOString()}"}'::jsonb
            `)
          },
          { 
            where: { masterWalletId: id },
            transaction
          }
        );
      }

      const updateData = { 
        active: newStatus,
        metadata: {
          ...wallet.metadata,
          lastStatusChange: new Date(),
          statusChangeReason: reason
        }
      };

      await MasterWallet.update(updateData, {
        where: { id },
        transaction
      });
      
      await transaction.commit();
      
      return await MasterWallet.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al actualizar status: ${error.message}`);
    }
  };

  // =================== MÉTODOS DE SINCRONIZACIÓN CON BLOCKCHAIN ===================

  MasterWallet.syncBalance = async (id, blockchainBalance) => {
    try {
      const wallet = await MasterWallet.findByPk(id);
      if (!wallet) {
        throw new Error('Wallet maestra no encontrada');
      }

      const currentBalance = String(wallet.totalBalance);
      const newBalance = String(blockchainBalance);
      const tolerance = '0.00000001'; // Tolerancia para diferencias mínimas

      const difference = money.subtract(newBalance, currentBalance);
      const absDifference = money.compare(difference, '0') < 0
        ? money.multiply(difference, '-1')
        : difference;

      if (money.compare(absDifference, tolerance) > 0) {
        const updated = await MasterWallet.updateBalance(id, newBalance);

        return {
          synchronized: true,
          previousBalance: currentBalance,
          newBalance: newBalance,
          difference: difference,
          wallet: updated
        };
      }

      // Actualizar solo timestamp de sincronización
      await MasterWallet.update(
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

  MasterWallet.syncAllBalances = async (balancesData) => {
    const transaction = await sequelize.transaction();
    
    try {
      const results = [];
      
      for (const balanceData of balancesData) {
        try {
          let wallet = null;
          
          // Buscar por dirección o XPUB
          if (balanceData.address) {
            wallet = await MasterWallet.getByAddress(balanceData.address);
          } else if (balanceData.xpub) {
            wallet = await MasterWallet.getByXpub(balanceData.xpub);
          }
          
          if (wallet) {
            const syncResult = await MasterWallet.syncBalance(wallet.id, balanceData.balance);
            results.push({
              walletId: wallet.id,
              crypto: wallet.crypto?.symbol || wallet.symbol,
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

  MasterWallet.getFundsDistribution = async () => {
    try {
      const distribution = await MasterWallet.findAll({
        attributes: [
          'id',
          'name',
          'symbol',
          'network',
          'totalBalance',
          'publicAddress',
          [
            sequelize.literal(`
              ROUND(
                (total_balance / NULLIF((SELECT SUM(total_balance) FROM master_wallets WHERE active = true), 0)) * 100, 
                4
              )
            `),
            'percentage'
          ]
        ],
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['symbol', 'name', 'network', 'decimals']
          }
        ],
        where: { active: true },
        order: [['total_balance', 'DESC']],
        raw: false
      });

      return distribution;
    } catch (error) {
      throw new Error(`Error al obtener distribución de fondos: ${error.message}`);
    }
  };

  // =================== MÉTODOS DE UTILIDAD PARA HD WALLETS ===================

  MasterWallet.incrementDerivationIndex = async (id, transaction = null) => {
    try {
      const wallet = await MasterWallet.findByPk(id, { transaction });
      
      if (!wallet) {
        throw new Error('Wallet maestra no encontrada');
      }

      const newIndex = wallet.nextDerivationIndex + 1;
      
      await MasterWallet.update(
        { nextDerivationIndex: newIndex },
        { where: { id }, transaction }
      );

      return wallet.nextDerivationIndex; // Retorna el índice usado
    } catch (error) {
      throw new Error(`Error al incrementar índice de derivación: ${error.message}`);
    }
  };

  MasterWallet.validateXpubNetwork = (xpub, network) => {
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

  MasterWallet.getTreasuryMetrics = async (timeframe = '30 days') => {
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
      const balanceSummary = await MasterWallet.getBalanceSummary();
      const totalValue = balanceSummary.reduce((acc, item) => {
        return acc + parseFloat(item.dataValues.totalBalance || 0);
      }, 0);

      // Distribución por blockchain/network
      const networkDistribution = {};
      for (const balance of balanceSummary) {
        const network = balance.network;
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
      const lowBalanceWallets = await MasterWallet.getWithLowBalance(0.1);
      const staleSyncWallets = await MasterWallet.findAll({
        where: {
          active: true,
          [Op.or]: [
            { lastSyncAt: null },
            { lastSyncAt: { [Op.lt]: startDate } }
          ]
        },
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'crypto'
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

  MasterWallet.createBulkWallets = async (walletsData) => {
    const transaction = await sequelize.transaction();
    
    try {
      const results = [];
      const errors = [];
      
      for (const walletData of walletsData) {
        try {
          const nuevaWallet = await MasterWallet.createWallet(walletData);
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

  return MasterWallet;
}

module.exports = createWalletMaestraModel;