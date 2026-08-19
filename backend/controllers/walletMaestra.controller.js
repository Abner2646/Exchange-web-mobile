const { WalletMaestra } = require('../models/index.js');

// =================== CONTROLADORES CRUD BÁSICOS ===================

// Listar wallets maestras con filtros avanzados (solo admin)
const getWalletsMaestras = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await WalletMaestra.getAll(filters);
    
    res.json({
      success: true,
      data: result,
      message: `${result.total} wallets maestras encontradas`
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message,
      code: 'GET_WALLETS_ERROR'
    });
  }
};

// Obtener wallet maestra por ID (solo admin)
const getWalletMaestraById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        success: false,
        error: 'ID es requerido',
        code: 'MISSING_ID'
      });
    }

    const result = await WalletMaestra.getById(id);
    
    if (!result) {
      return res.status(404).json({ 
        success: false,
        error: 'Wallet maestra no encontrada',
        code: 'WALLET_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      data: result,
      message: 'Wallet maestra encontrada'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message,
      code: 'GET_WALLET_ERROR'
    });
  }
};

// Crear nueva wallet maestra con validación HD (solo super admin)
const createWalletMaestra = async (req, res) => {
  try {
    const { 
      criptomonedaId,
      nombre,
      red,
      symbol,
      xpub,                    // CRÍTICO
      derivationPath = "m/44'/0'/0'",
      direccionPublica,        // Opcional ahora
      fingerprint,
      publicKey,
      descripcion,
      balanceTotal = 0
    } = req.body;
    
    // Validaciones obligatorias
    if (!criptomonedaId || !nombre || !red || !symbol || !xpub) {
      return res.status(400).json({ 
        success: false,
        error: 'Los campos criptomonedaId, nombre, red, symbol y xpub son requeridos',
        code: 'MISSING_REQUIRED_FIELDS',
        required: ['criptomonedaId', 'nombre', 'red', 'symbol', 'xpub']
      });
    }

    // Validar formato de XPUB para la red
    const xpubValidation = WalletMaestra.validateXpubNetwork(xpub, red);
    if (!xpubValidation.valid) {
      return res.status(400).json({
        success: false,
        error: `XPUB inválido: ${xpubValidation.message}`,
        code: 'INVALID_XPUB'
      });
    }

    const walletData = {
      criptomonedaId,
      nombre,
      red: red.toLowerCase(),
      symbol: symbol.toUpperCase(),
      xpub,
      derivationPath,
      direccionPublica,
      fingerprint,
      publicKey,
      descripcion,
      balanceTotal: parseFloat(balanceTotal),
      activa: true,
      metadata: {
        createdBy: req.user?.id || 'admin',
        createdAt: new Date(),
        version: '2.0'
      }
    };

    const nuevaWallet = await WalletMaestra.createWallet(walletData);
    
    res.status(201).json({ 
      success: true,
      data: nuevaWallet,
      message: `Wallet maestra '${nombre}' creada exitosamente`,
      code: 'WALLET_CREATED'
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message,
      code: 'CREATE_WALLET_ERROR'
    });
  }
};

// =================== CONTROLADORES DE BÚSQUEDA Y CONSULTA ===================

// Obtener wallet por criptomoneda específica
const getWalletByCriptomoneda = async (req, res) => {
  try {
    const { criptomonedaId } = req.params;
    
    if (!criptomonedaId) {
      return res.status(400).json({
        success: false,
        error: 'criptomonedaId es requerido',
        code: 'MISSING_CRYPTO_ID'
      });
    }

    const wallet = await WalletMaestra.getByCriptomoneda(criptomonedaId);
    
    if (!wallet) {
      return res.status(404).json({ 
        success: false,
        error: 'No existe wallet maestra para esta criptomoneda',
        code: 'WALLET_NOT_FOUND_FOR_CRYPTO'
      });
    }
    
    res.json({
      success: true,
      data: wallet,
      message: 'Wallet maestra encontrada'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message,
      code: 'GET_WALLET_BY_CRYPTO_ERROR'
    });
  }
};

// Obtener solo wallets activas con filtros
const getActiveWallets = async (req, res) => {
  try {
    const { red, soloActivasCrypto = true } = req.query;
    
    const options = {
      red: red?.toLowerCase(),
      soloActivasCrypto: soloActivasCrypto === 'true'
    };

    const wallets = await WalletMaestra.getActive(options);
    
    res.json({
      success: true,
      data: wallets,
      count: wallets.length,
      filters: options,
      message: `${wallets.length} wallets activas encontradas`
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message,
      code: 'GET_ACTIVE_WALLETS_ERROR'
    });
  }
};

// =================== CONTROLADORES DE BALANCE Y MONITOREO ===================

// Obtener distribución de fondos
const getFundsDistribution = async (req, res) => {
  try {
    const distribution = await WalletMaestra.getFundsDistribution();
    
    res.json({
      success: true,
      data: distribution,
      count: distribution.length,
      message: 'Distribución de fondos obtenida'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message,
      code: 'GET_FUNDS_DISTRIBUTION_ERROR'
    });
  }
};

// =================== CONTROLADORES DE GESTIÓN DE ESTADO ===================

// =================== CONTROLADORES DE GESTIÓN DE BALANCES ===================

// =================== CONTROLADORES DE SINCRONIZACIÓN ===================

// =================== CONTROLADORES DE TREASURY Y OPERACIONES ===================

// Métricas de tesorería
const getTreasuryMetrics = async (req, res) => {
  try {
    const { timeframe = '30 days' } = req.query;
    
    const validTimeframes = ['7 days', '30 days', '90 days', '1 year'];
    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({
        success: false,
        error: `Timeframe debe ser uno de: ${validTimeframes.join(', ')}`,
        code: 'INVALID_TIMEFRAME'
      });
    }

    const metrics = await WalletMaestra.getTreasuryMetrics(timeframe);

    res.json({
      success: true,
      data: metrics,
      message: `Métricas de treasury para ${timeframe}`,
      code: 'TREASURY_METRICS_OBTAINED'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message,
      code: 'GET_TREASURY_METRICS_ERROR'
    });
  }
};

// =================== CONTROLADORES DE DASHBOARD Y ANÁLISIS ===================

// Dashboard de wallets maestras
const getWalletsDashboard = async (req, res) => {
  try {
    const { timeframe = '30 days' } = req.query;

    const [stats, balanceSummary, lowBalanceWallets, highBalanceWallets, fundsDistribution] = await Promise.all([
      WalletMaestra.getStats({ timeframe }),
      WalletMaestra.getBalanceSummary(),
      WalletMaestra.getWithLowBalance(0.01),
      WalletMaestra.getWithHighBalance(100),
      WalletMaestra.getFundsDistribution()
    ]);

    // Calcular valor total
    const totalValue = balanceSummary.reduce((acc, item) => {
      return acc + parseFloat(item.dataValues.totalBalance || 0);
    }, 0);

    const dashboard = {
      estadisticas: stats,
      valorTotal: totalValue,
      resumenBalances: balanceSummary,
      alertas: {
        balanceBajo: {
          count: lowBalanceWallets.length,
          threshold: 0.01,
          wallets: lowBalanceWallets.slice(0, 3)
        },
        balanceAlto: {
          count: highBalanceWallets.length,
          threshold: 100,
          wallets: highBalanceWallets.slice(0, 3)
        }
      },
      distribucionFondos: fundsDistribution.slice(0, 10), // Top 10
      ultimaActualizacion: new Date()
    };

    res.json({
      success: true,
      data: dashboard,
      message: 'Dashboard de wallets maestras generado',
      code: 'DASHBOARD_GENERATED'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message,
      code: 'GET_DASHBOARD_ERROR'
    });
  }
};

// =================== CONTROLADORES ADMINISTRATIVOS ===================

// Obtener estadísticas de wallets maestras
const getWalletMaestraStats = async (req, res) => {
  try {
    const filters = { ...req.query };
    const stats = await WalletMaestra.getStats(filters);
    
    res.json({
      success: true,
      data: stats,
      filters: filters,
      message: 'Estadísticas de wallets maestras obtenidas',
      code: 'STATS_OBTAINED'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message,
      code: 'GET_STATS_ERROR'
    });
  }
};

// Exportar wallets a CSV
const exportWallets = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await WalletMaestra.getAll(filters);
    const wallets = result.wallets || result;
    
    if (!Array.isArray(wallets) || wallets.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No se encontraron wallets para exportar',
        code: 'NO_WALLETS_TO_EXPORT'
      });
    }
    
    // Convertir a formato CSV
    const csvHeader = [
      'ID',
      'Nombre', 
      'Red',
      'Symbol',
      'Direccion Publica',
      'Balance Total',
      'Activa',
      'XPUB (Parcial)',
      'Direcciones Generadas',
      'Ultima Sincronizacion',
      'Fecha Creacion'
    ].join(',') + '\n';
    
    const csvData = wallets.map(wallet => {
      return [
        wallet.id,
        `"${wallet.nombre || ''}"`,
        wallet.red || '',
        wallet.symbol || '',
        `"${wallet.direccionPublica || ''}"`,
        wallet.balanceTotal || 0,
        wallet.activa ? 'SI' : 'NO',
        `"${wallet.xpub ? wallet.xpub.substring(0, 20) + '...' : ''}"`,
        wallet.direccionesDeposito ? wallet.direccionesDeposito.length : 0,
        wallet.lastSyncAt ? new Date(wallet.lastSyncAt).toISOString() : '',
        new Date(wallet.created_at).toISOString()
      ].join(',');
    }).join('\n');
    
    const csv = csvHeader + csvData;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="wallets_maestras_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('\ufeff' + csv); // BOM para Excel
    
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message,
      code: 'EXPORT_WALLETS_ERROR'
    });
  }
};

// =================== CONTROLADORES NUEVOS PARA HD WALLETS ===================

// =================== CONTROLADORES DE SALUD Y MANTENIMIENTO ===================

// Health check de wallets maestras
const healthCheck = async (req, res) => {
  try {
    const [activeWallets, totalWallets, lowBalanceCount, staleSync] = await Promise.all([
      WalletMaestra.count({ where: { activa: true } }),
      WalletMaestra.count(),
      WalletMaestra.count({ 
        where: { 
          activa: true, 
          balanceTotal: { [require('sequelize').Op.lt]: 0.01 } 
        } 
      }),
      WalletMaestra.count({
        where: {
          activa: true,
          [require('sequelize').Op.or]: [
            { lastSyncAt: null },
            { lastSyncAt: { [require('sequelize').Op.lt]: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
          ]
        }
      })
    ]);

    const health = {
      status: 'healthy',
      activeWallets,
      totalWallets,
      inactiveWallets: totalWallets - activeWallets,
      alerts: {
        lowBalance: lowBalanceCount,
        staleSync: staleSync
      },
      timestamp: new Date()
    };

    // Determinar estado de salud
    if (staleSync > activeWallets * 0.5 || lowBalanceCount > activeWallets * 0.3) {
      health.status = 'warning';
    }

    if (activeWallets === 0 || staleSync === activeWallets) {
      health.status = 'critical';
    }

    res.json({
      success: true,
      data: health,
      message: `Sistema de wallets maestras: ${health.status}`,
      code: 'HEALTH_CHECK_COMPLETED'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'HEALTH_CHECK_ERROR'
    });
  }
};

module.exports = {
  // CRUD básicos
  getWalletsMaestras,
  getWalletMaestraById,
  createWalletMaestra,

  // Búsqueda y consulta
  getWalletByCriptomoneda,
  getActiveWallets,

  // Balance y monitoreo
  getFundsDistribution,

  // Treasury y operaciones
  getTreasuryMetrics,

  // Dashboard y análisis
  getWalletsDashboard,

  // Administrativos
  getWalletMaestraStats,
  exportWallets,
  healthCheck
};