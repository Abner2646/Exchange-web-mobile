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

// Actualizar wallet maestra por ID (solo admin)
const updateWalletMaestra = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Agregar información de auditoría
    updateData.metadata = {
      ...updateData.metadata,
      lastModifiedBy: req.user?.id || 'admin',
      lastModifiedAt: new Date()
    };

    const updatedWallet = await WalletMaestra.updateWallet(id, updateData);

    res.json({ 
      success: true,
      data: updatedWallet,
      message: 'Wallet maestra actualizada exitosamente',
      code: 'WALLET_UPDATED'
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message,
      code: 'UPDATE_WALLET_ERROR'
    });
  }
};

// Eliminar wallet maestra por ID (solo super admin)
const deleteWalletMaestra = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await WalletMaestra.deleteWallet(id);
    
    res.json({
      success: true,
      data: result,
      message: 'Wallet maestra eliminada correctamente',
      code: 'WALLET_DELETED'
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message,
      code: 'DELETE_WALLET_ERROR'
    });
  }
};

// =================== CONTROLADORES DE BÚSQUEDA Y CONSULTA ===================

// Buscar wallets maestras con términos múltiples
const searchWalletsMaestras = async (req, res) => {
  try {
    const { q: term, limit = 10 } = req.query;
    
    if (!term || term.trim().length < 2) {
      return res.status(400).json({ 
        success: false,
        error: 'Término de búsqueda debe tener al menos 2 caracteres',
        code: 'INVALID_SEARCH_TERM'
      });
    }

    const result = await WalletMaestra.search(term.trim(), limit);
    
    res.json({
      success: true,
      data: result,
      count: result.length,
      searchTerm: term,
      message: `${result.length} wallets encontradas`
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message,
      code: 'SEARCH_WALLETS_ERROR'
    });
  }
};

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

// Obtener wallet por dirección específica
const getWalletByAddress = async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || address.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Dirección inválida',
        code: 'INVALID_ADDRESS'
      });
    }

    const wallet = await WalletMaestra.getByAddress(address);
    
    if (!wallet) {
      return res.status(404).json({ 
        success: false,
        error: 'Wallet maestra no encontrada para esa dirección',
        code: 'WALLET_NOT_FOUND_FOR_ADDRESS'
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
      code: 'GET_WALLET_BY_ADDRESS_ERROR'
    });
  }
};

// Obtener wallet por XPUB
const getWalletByXpub = async (req, res) => {
  try {
    const { xpub } = req.params;
    
    if (!xpub) {
      return res.status(400).json({
        success: false,
        error: 'XPUB es requerido',
        code: 'MISSING_XPUB'
      });
    }

    const wallet = await WalletMaestra.getByXpub(xpub);
    
    if (!wallet) {
      return res.status(404).json({ 
        success: false,
        error: 'Wallet maestra no encontrada para ese XPUB',
        code: 'WALLET_NOT_FOUND_FOR_XPUB'
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
      code: 'GET_WALLET_BY_XPUB_ERROR'
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

// Obtener wallets con balance bajo
const getLowBalanceWallets = async (req, res) => {
  try {
    const { threshold = 0.01 } = req.query;
    const parsedThreshold = parseFloat(threshold);
    
    if (parsedThreshold < 0) {
      return res.status(400).json({
        success: false,
        error: 'El threshold debe ser mayor o igual a 0',
        code: 'INVALID_THRESHOLD'
      });
    }

    const wallets = await WalletMaestra.getWithLowBalance(parsedThreshold);
    
    res.json({
      success: true,
      data: wallets,
      threshold: parsedThreshold,
      count: wallets.length,
      message: `${wallets.length} wallets con balance bajo (< ${parsedThreshold})`
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message,
      code: 'GET_LOW_BALANCE_WALLETS_ERROR'
    });
  }
};

// Obtener wallets con balance alto
const getHighBalanceWallets = async (req, res) => {
  try {
    const { threshold = 100 } = req.query;
    const parsedThreshold = parseFloat(threshold);
    
    if (parsedThreshold <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El threshold debe ser mayor a 0',
        code: 'INVALID_THRESHOLD'
      });
    }

    const wallets = await WalletMaestra.getWithHighBalance(parsedThreshold);
    
    res.json({
      success: true,
      data: wallets,
      threshold: parsedThreshold,
      count: wallets.length,
      message: `${wallets.length} wallets con balance alto (>= ${parsedThreshold})`
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message,
      code: 'GET_HIGH_BALANCE_WALLETS_ERROR'
    });
  }
};

// Obtener resumen completo de balances
const getBalanceSummary = async (req, res) => {
  try {
    const { red, fechaDesde } = req.query;
    
    const options = {};
    if (red) options.red = red.toLowerCase();
    if (fechaDesde) options.fechaDesde = fechaDesde;

    const summary = await WalletMaestra.getBalanceSummary(options);
    
    // Calcular totales
    const totalValue = summary.reduce((acc, item) => {
      return acc + parseFloat(item.dataValues.totalBalance || 0);
    }, 0);

    const totalWallets = summary.reduce((acc, item) => {
      return acc + parseInt(item.dataValues.walletCount || 0);
    }, 0);

    res.json({
      success: true,
      data: {
        resumen: {
          valorTotal: totalValue,
          totalWallets: totalWallets,
          criptomonedas: summary.length
        },
        detallesPorCriptomoneda: summary
      },
      message: `Resumen de ${summary.length} criptomonedas`
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message,
      code: 'GET_BALANCE_SUMMARY_ERROR'
    });
  }
};

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

// Actualizar estado de wallet (activar/desactivar)
const updateWalletStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { activa, reason } = req.body;
    
    if (typeof activa !== 'boolean') {
      return res.status(400).json({ 
        success: false,
        error: 'El campo activa debe ser un valor booleano',
        code: 'INVALID_STATUS_VALUE'
      });
    }

    const updated = await WalletMaestra.updateStatus(id, activa, reason);
    
    res.json({ 
      success: true,
      data: updated,
      message: `Wallet maestra ${activa ? 'activada' : 'desactivada'} exitosamente`,
      code: 'STATUS_UPDATED'
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message,
      code: 'UPDATE_STATUS_ERROR'
    });
  }
};

// Alternar estado de wallet
const toggleWalletStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const wallet = await WalletMaestra.getById(id);
    
    if (!wallet) {
      return res.status(404).json({ 
        success: false,
        error: 'Wallet maestra no encontrada',
        code: 'WALLET_NOT_FOUND'
      });
    }

    const newStatus = !wallet.activa;
    const updated = await WalletMaestra.updateStatus(id, newStatus, reason);
    
    res.json({ 
      success: true,
      data: updated,
      previousStatus: wallet.activa,
      newStatus: newStatus,
      message: `Wallet maestra ${newStatus ? 'activada' : 'desactivada'} exitosamente`,
      code: 'STATUS_TOGGLED'
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message,
      code: 'TOGGLE_STATUS_ERROR'
    });
  }
};

// =================== CONTROLADORES DE GESTIÓN DE BALANCES ===================

// Actualizar balance específico
const updateWalletBalance = async (req, res) => {
  try {
    const { id } = req.params;
    const { balance } = req.body;
    
    if (balance === undefined || balance < 0) {
      return res.status(400).json({ 
        success: false,
        error: 'El balance debe ser un número mayor o igual a 0',
        code: 'INVALID_BALANCE'
      });
    }

    const updated = await WalletMaestra.updateBalance(id, parseFloat(balance));
    
    res.json({ 
      success: true,
      data: updated,
      newBalance: parseFloat(balance),
      message: 'Balance actualizado exitosamente',
      code: 'BALANCE_UPDATED'
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message,
      code: 'UPDATE_BALANCE_ERROR'
    });
  }
};

// Sumar al balance
const addToBalance = async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad } = req.body;
    
    if (!cantidad || cantidad <= 0) {
      return res.status(400).json({ 
        success: false,
        error: 'La cantidad debe ser un número mayor a 0',
        code: 'INVALID_AMOUNT'
      });
    }

    const updated = await WalletMaestra.addToBalance(id, parseFloat(cantidad));
    
    res.json({ 
      success: true,
      data: updated,
      amountAdded: parseFloat(cantidad),
      message: `Se añadieron ${cantidad} al balance exitosamente`,
      code: 'BALANCE_ADDED'
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message,
      code: 'ADD_BALANCE_ERROR'
    });
  }
};

// Restar del balance
const subtractFromBalance = async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad } = req.body;
    
    if (!cantidad || cantidad <= 0) {
      return res.status(400).json({ 
        success: false,
        error: 'La cantidad debe ser un número mayor a 0',
        code: 'INVALID_AMOUNT'
      });
    }

    const updated = await WalletMaestra.subtractFromBalance(id, parseFloat(cantidad));
    
    res.json({ 
      success: true,
      data: updated,
      amountSubtracted: parseFloat(cantidad),
      message: `Se restaron ${cantidad} del balance exitosamente`,
      code: 'BALANCE_SUBTRACTED'
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message,
      code: 'SUBTRACT_BALANCE_ERROR'
    });
  }
};

// =================== CONTROLADORES DE SINCRONIZACIÓN ===================

// Sincronizar balance con blockchain
const syncBalance = async (req, res) => {
  try {
    const { id } = req.params;
    const { blockchainBalance } = req.body;
    
    if (blockchainBalance === undefined || blockchainBalance < 0) {
      return res.status(400).json({ 
        success: false,
        error: 'blockchainBalance es requerido y debe ser mayor o igual a 0',
        code: 'INVALID_BLOCKCHAIN_BALANCE'
      });
    }

    const result = await WalletMaestra.syncBalance(id, parseFloat(blockchainBalance));
    
    res.json({
      success: true,
      data: result,
      message: result.synchronized ? 
        'Balance sincronizado exitosamente' : 
        'Balance ya estaba sincronizado',
      code: result.synchronized ? 'BALANCE_SYNCHRONIZED' : 'BALANCE_ALREADY_SYNCED'
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message,
      code: 'SYNC_BALANCE_ERROR'
    });
  }
};

// Sincronizar todos los balances (webhook o batch)
const syncAllBalances = async (req, res) => {
  try {
    const { balances } = req.body;
    
    if (!Array.isArray(balances) || balances.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Se requiere un array de balances con formato: [{address/xpub, balance}]',
        code: 'INVALID_BALANCES_FORMAT'
      });
    }

    // Validar formato de cada balance
    for (const [index, balance] of balances.entries()) {
      if ((!balance.address && !balance.xpub) || balance.balance === undefined) {
        return res.status(400).json({ 
          success: false,
          error: `Balance en índice ${index} debe tener (address o xpub) y balance`,
          code: 'INVALID_BALANCE_FORMAT'
        });
      }
    }

    const result = await WalletMaestra.syncAllBalances(balances);
    
    res.json({
      success: true,
      data: result,
      message: `Procesados ${result.totalProcessed} balances, ${result.synchronized} sincronizados, ${result.errors} errores`,
      code: 'BULK_SYNC_COMPLETED'
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message,
      code: 'SYNC_ALL_BALANCES_ERROR'
    });
  }
};

// =================== CONTROLADORES DE TREASURY Y OPERACIONES ===================

// Consolidar fondos entre wallets
const consolidateFunds = async (req, res) => {
  try {
    const { fromWalletId, toWalletId, amount, reason = 'consolidation' } = req.body;
    
    if (!fromWalletId || !toWalletId || !amount || amount <= 0) {
      return res.status(400).json({ 
        success: false,
        error: 'fromWalletId, toWalletId y amount (mayor a 0) son requeridos',
        code: 'MISSING_CONSOLIDATION_DATA'
      });
    }

    if (fromWalletId === toWalletId) {
      return res.status(400).json({ 
        success: false,
        error: 'Las wallets origen y destino deben ser diferentes',
        code: 'SAME_WALLET_CONSOLIDATION'
      });
    }

    const result = await WalletMaestra.consolidateFunds(
      fromWalletId, 
      toWalletId, 
      parseFloat(amount),
      reason
    );

    res.json({
      success: true,
      data: result,
      message: `Consolidación completada: ${amount} transferidos exitosamente`,
      code: 'FUNDS_CONSOLIDATED'
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message,
      code: 'CONSOLIDATE_FUNDS_ERROR'
    });
  }
};

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

// Crear múltiples wallets maestras (bulk creation)
const createBulkWallets = async (req, res) => {
  try {
    const { wallets } = req.body;
    
    if (!Array.isArray(wallets) || wallets.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de wallets para crear',
        code: 'INVALID_BULK_DATA'
      });
    }

    if (wallets.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Máximo 50 wallets por operación bulk',
        code: 'BULK_LIMIT_EXCEEDED'
      });
    }

    const result = await WalletMaestra.createBulkWallets(wallets);

    res.status(201).json({
      success: true,
      data: result,
      message: `${result.created} wallets creadas exitosamente`,
      code: 'BULK_WALLETS_CREATED'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'CREATE_BULK_WALLETS_ERROR'
    });
  }
};

// Validar XPUB para una red específica
const validateXpub = async (req, res) => {
  try {
    const { xpub, network } = req.body;
    
    if (!xpub || !network) {
      return res.status(400).json({
        success: false,
        error: 'xpub y network son requeridos',
        code: 'MISSING_VALIDATION_DATA'
      });
    }

    const validation = WalletMaestra.validateXpubNetwork(xpub, network);

    res.json({
      success: true,
      data: {
        xpub: xpub.substring(0, 20) + '...', // Solo mostrar parte
        network,
        ...validation
      },
      message: validation.valid ? 'XPUB válido' : 'XPUB inválido',
      code: validation.valid ? 'XPUB_VALID' : 'XPUB_INVALID'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'VALIDATE_XPUB_ERROR'
    });
  }
};

// Obtener el siguiente índice de derivación disponible
const getNextDerivationIndex = async (req, res) => {
  try {
    const { id } = req.params;
    
    const wallet = await WalletMaestra.getById(id);
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet maestra no encontrada',
        code: 'WALLET_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        walletId: id,
        currentIndex: wallet.nextDerivationIndex || 0,
        nextIndex: (wallet.nextDerivationIndex || 0) + 1
      },
      message: 'Índice de derivación obtenido',
      code: 'DERIVATION_INDEX_OBTAINED'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'GET_DERIVATION_INDEX_ERROR'
    });
  }
};

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
  updateWalletMaestra,
  deleteWalletMaestra,
  
  // Búsqueda y consulta
  searchWalletsMaestras,
  getWalletByCriptomoneda,
  getWalletByAddress,
  getWalletByXpub,
  getActiveWallets,
  
  // Balance y monitoreo
  getLowBalanceWallets,
  getHighBalanceWallets,
  getBalanceSummary,
  getFundsDistribution,
  
  // Gestión de estado
  updateWalletStatus,
  toggleWalletStatus,
  
  // Gestión de balances
  updateWalletBalance,
  addToBalance,
  subtractFromBalance,
  
  // Sincronización
  syncBalance,
  syncAllBalances,
  
  // Treasury y operaciones
  consolidateFunds,
  getTreasuryMetrics,
  
  // Dashboard y análisis
  getWalletsDashboard,
  
  // Administrativos
  getWalletMaestraStats,
  exportWallets,
  
  // Nuevos para HD Wallets
  createBulkWallets,
  validateXpub,
  getNextDerivationIndex,
  healthCheck
};