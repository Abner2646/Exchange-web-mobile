// controllers/transaccionBlockchain.controller.js
const { TransaccionBlockchain, Usuario, Criptomoneda, BalanceUsuario, DireccionDeposito } = require('../models');
const BlockchainServiceManager = require('../services/blockchain');
// Fix 2026-08-19 (AUDITORIA_BACKEND.md Críticos #8): estos endpoints
// llamaban a scanAllNetworksForDeposits/processAllPendingWithdrawals/
// updateAllConfirmations en BlockchainServiceManager, que nunca existieron
// ahí — la lógica real vive en BlockchainJobManager (jobs/blockchain.jobs.js),
// que es lo mismo que corre el scheduler. Estos endpoints ahora disparan
// esos mismos jobs a demanda, en vez de apuntar a métodos inexistentes.
const BlockchainJobManager = require('../jobs/blockchain.jobs');
const AppError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');
const money = require('../utils/money');
const idempotency = require('../middleware/idempotency.middleware');

class TransaccionBlockchainController {
  // =================== ENDPOINTS PARA USUARIOS ===================

  // GET /api/transactions/my - Obtener transacciones del usuario
  async getMyTransactions(req, res) {
    const userId = req.user.id;
    const filters = {
      tipo: req.query.tipo,
      estado: req.query.estado,
      criptomonedaId: req.query.criptomonedaId,
      fechaDesde: req.query.fechaDesde,
      fechaHasta: req.query.fechaHasta,
      limit: req.query.limit || 20,
      offset: req.query.offset || 0
    };

    const result = await TransaccionBlockchain.getByUser(userId, filters);

    res.json({
      success: true,
      data: result
    });
  }

  // GET /api/transactions/:id - Obtener transacción específica
  async getTransaction(req, res) {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.rol;

    const transaccion = await TransaccionBlockchain.getById(id);

    if (!transaccion) {
      throw new AppError(404, errorCodes.TRANSACTION_NOT_FOUND, 'Transacción no encontrada');
    }

    // Solo el propietario o admin puede ver la transacción
    if (transaccion.userId !== userId && !['admin', 'super_admin'].includes(userRole)) {
      throw new AppError(403, errorCodes.TRANSACTION_FORBIDDEN, 'No autorizado para ver esta transacción');
    }

    res.json({
      success: true,
      data: transaccion
    });
  }

  // POST /api/transactions/withdraw - Crear retiro
  async createWithdrawal(req, res) {
    const userId = req.user.id;
    const { criptomonedaId, cantidad, direccionDestino } = req.body;

    // Validar retiro
    const validation = await TransaccionBlockchain.validateWithdrawal(
      userId,
      criptomonedaId,
      cantidad,
      direccionDestino
    );

    if (!validation.valid) {
      throw new AppError(400, errorCodes.WITHDRAWAL_VALIDATION_FAILED, validation.message);
    }

    // Validar dirección con el servicio de blockchain
    const blockchainService = BlockchainServiceManager.getService(validation.criptomoneda.red);
    const isValidAddress = await blockchainService.validateAddress(direccionDestino);

    if (!isValidAddress) {
      throw new AppError(400, errorCodes.WITHDRAWAL_INVALID_ADDRESS, 'Dirección de destino inválida');
    }

    // Crear retiro. El body se arma UNA vez dentro del hook `finalize` (que corre
    // en la tx del retiro) y se envía verbatim, así el response y el que se guarda
    // para replay de idempotencia son idénticos.
    let responseBody;
    await TransaccionBlockchain.createWithdrawal({
      userId,
      criptomonedaId,
      cantidad: parseFloat(cantidad),
      direccionDestino,
      confirmacionesRequeridas: validation.criptomoneda.red === 'bitcoin' ? 6 :
                                 validation.criptomoneda.red === 'ethereum' ? 12 : 6
    }, {
      // Hardening anti-doble-gasto: completa la key de idempotencia dentro de la
      // tx del retiro → el bloqueo de fondos, el alta de la fila y el 'completed'
      // commitean atómicamente. Cierra la ventana crash-post-commit que permitía
      // re-bloquear fondos + crear un segundo retiro vía el reclaim de 90s.
      finalize: async (transaction, retiro) => {
        responseBody = { success: true, message: 'Retiro creado exitosamente', data: retiro };
        await idempotency.finalizeInTransaction(req, transaction, 201, responseBody);
      }
    });

    res.status(201).json(responseBody);
  }

  // GET /api/transactions/balances - Obtener balances del usuario
  // Read-flip (write-flip Paso A): saldos desde la PROYECCION del ledger
  // (getByUserId → Funding), no de balances_users; montos como strings canonicos
  // (no parseFloat). Se re-adjunta `criptomoneda` (solo las activas) por lookup.
  // Ya no hay `id` de fila ni `updated_at`; las criptos sin saldo no se listan.
  async getMyBalances(req, res) {
    const userId = req.user.id;

    const balances = await BalanceUsuario.getByUserId(userId);
    const criptomonedas = await Criptomoneda.findAll({
      where: { id: balances.map((b) => b.criptomonedaId), activa: true },
      attributes: ['id', 'symbol', 'nombre', 'red', 'decimales']
    });
    const criptoPorId = new Map(criptomonedas.map((c) => [c.id, c]));

    const balancesConTotal = balances
      .filter((b) => criptoPorId.has(b.criptomonedaId)) // solo criptos activas
      .map((b) => ({
        criptomoneda: criptoPorId.get(b.criptomonedaId),
        balanceDisponible: b.balanceDisponible,
        balanceBloqueado: b.balanceBloqueado,
        balanceTotal: money.add(b.balanceDisponible, b.balanceBloqueado)
      }))
      .sort((a, b) => a.criptomoneda.symbol.localeCompare(b.criptomoneda.symbol));

    res.json({
      success: true,
      data: balancesConTotal
    });
  }

  // GET /api/transactions/deposit-address/:criptomonedaId - Obtener dirección de depósito
  async getDepositAddress(req, res) {
    const userId = req.user.id;
    const { criptomonedaId } = req.params;

    // Verificar que la criptomoneda existe y está activa
    const criptomoneda = await Criptomoneda.findByPk(criptomonedaId);
    if (!criptomoneda || !criptomoneda.activa) {
      throw new AppError(404, errorCodes.DEPOSIT_CRYPTO_NOT_FOUND, 'Criptomoneda no encontrada o inactiva');
    }

    // ✅ CORRECCIÓN: Usar DireccionDeposito correctamente
    let direccion;

    try {
      direccion = await DireccionDeposito.getByUserAndCrypto(userId, criptomonedaId);
    } catch (error) {
      console.error('Error buscando dirección existente:', error.message);
    }

    if (!direccion) {
      // Generate new address — if this fails it is a server-side error (no safe recovery),
      // so throw AppError with a safe message rather than leaking the internal error.
      try {
        direccion = await DireccionDeposito.generateAddressForUser(userId, criptomonedaId);
      } catch (generateError) {
        console.error('Error generando nueva dirección:', generateError.message);
        throw new AppError(500, errorCodes.DEPOSIT_ADDRESS_GENERATION_FAILED, 'Error generando dirección de depósito');
      }
    }

    // ✅ CORRECCIÓN: Validar que la dirección se generó correctamente
    if (!direccion || !direccion.direccion) {
      throw new AppError(500, errorCodes.DEPOSIT_ADDRESS_GENERATION_FAILED, 'No se pudo obtener dirección de depósito');
    }

    res.json({
      success: true,
      data: {
        direccion: direccion.direccion,
        criptomoneda: direccion.criptomoneda || criptomoneda,
        qrCode: `${criptomoneda.symbol}:${direccion.direccion}`,
        derivationIndex: direccion.derivationIndex,
        metadata: {
          createdAt: direccion.created_at,
          network: criptomoneda.red,
          confirmationsRequired: direccion.confirmacionesRequeridas ||
            (criptomoneda.red === 'bitcoin' ? 3 :
            criptomoneda.red === 'ethereum' ? 12 : 6)
        },
        mensaje: `Esta es tu dirección para depósitos de ${criptomoneda.symbol}. Los depósitos se acreditarán automáticamente después de las confirmaciones requeridas.`
      }
    });
  }

  // =================== ENDPOINTS ADMINISTRATIVOS ===================

  // GET /api/admin/transactions - Obtener todas las transacciones (admin)
  async getAllTransactions(req, res) {
    if (!['admin', 'super_admin'].includes(req.user.rol)) {
      throw new AppError(403, errorCodes.ADMIN_FORBIDDEN, 'No autorizado');
    }

    const filters = {
      tipo: req.query.tipo,
      estado: req.query.estado,
      userId: req.query.userId,
      criptomonedaId: req.query.criptomonedaId,
      requiereAprobacion: req.query.requiereAprobacion,
      montoMin: req.query.montoMin,
      montoMax: req.query.montoMax,
      fechaDesde: req.query.fechaDesde,
      fechaHasta: req.query.fechaHasta,
      limit: req.query.limit || 50,
      offset: req.query.offset || 0
    };

    const result = await TransaccionBlockchain.getAllWithFilters(filters);

    res.json({
      success: true,
      data: result
    });
  }

  // GET /api/admin/transactions/pending - Obtener transacciones pendientes
  async getPendingTransactions(req, res) {
    if (!['admin', 'super_admin'].includes(req.user.rol)) {
      throw new AppError(403, errorCodes.ADMIN_FORBIDDEN, 'No autorizado');
    }

    const pendingDeposits = await TransaccionBlockchain.getPendingDeposits();
    const pendingWithdrawals = await TransaccionBlockchain.getPendingWithdrawals();

    res.json({
      success: true,
      data: {
        depositos: pendingDeposits,
        retiros: pendingWithdrawals,
        total: pendingDeposits.length + pendingWithdrawals.length
      }
    });
  }

  // POST /api/admin/transactions/:id/approve - Aprobar transacción
  async approveTransaction(req, res) {
    if (!['admin', 'super_admin'].includes(req.user.rol)) {
      throw new AppError(403, errorCodes.ADMIN_FORBIDDEN, 'No autorizado');
    }

    const { id } = req.params;
    const adminId = req.user.id;

    const transaccion = await TransaccionBlockchain.findByPk(id);
    if (!transaccion) {
      throw new AppError(404, errorCodes.TRANSACTION_NOT_FOUND, 'Transacción no encontrada');
    }

    if (transaccion.estado !== 'pendiente') {
      throw new AppError(400, errorCodes.TRANSACTION_INVALID_STATE, 'Solo se pueden aprobar transacciones pendientes');
    }

    await TransaccionBlockchain.update(
      {
        aprobadoPor: adminId,
        fechaAprobacion: new Date(),
        requiereAprobacion: false,
        estado: 'procesando'
      },
      { where: { id } }
    );

    const updatedTransaction = await TransaccionBlockchain.getById(id);

    res.json({
      success: true,
      message: 'Transacción aprobada exitosamente',
      data: updatedTransaction
    });
  }

  // POST /api/admin/transactions/:id/reject - Rechazar transacción
  async rejectTransaction(req, res) {
    if (!['admin', 'super_admin'].includes(req.user.rol)) {
      throw new AppError(403, errorCodes.ADMIN_FORBIDDEN, 'No autorizado');
    }

    const { id } = req.params;
    const { razon } = req.body;

    const transaccion = await TransaccionBlockchain.findByPk(id);
    if (!transaccion) {
      throw new AppError(404, errorCodes.TRANSACTION_NOT_FOUND, 'Transacción no encontrada');
    }

    if (transaccion.tipo === 'retiro') {
      await TransaccionBlockchain.failWithdrawal(id, razon || 'Rechazado por administrador');
    } else {
      await TransaccionBlockchain.update(
        { estado: 'fallido' },
        { where: { id } }
      );
    }

    const updatedTransaction = await TransaccionBlockchain.getById(id);

    res.json({
      success: true,
      message: 'Transacción rechazada exitosamente',
      data: updatedTransaction
    });
  }

  // GET /api/admin/transactions/stats - Estadísticas de transacciones
  async getTransactionStats(req, res) {
    if (!['admin', 'super_admin'].includes(req.user.rol)) {
      throw new AppError(403, errorCodes.ADMIN_FORBIDDEN, 'No autorizado');
    }

    const filters = {
      fechaDesde: req.query.fechaDesde,
      fechaHasta: req.query.fechaHasta
    };

    const stats = await TransaccionBlockchain.getStats(filters);

    res.json({
      success: true,
      data: stats
    });
  }

  // =================== ENDPOINTS DE SISTEMA ===================

  // POST /api/system/scan-deposits - Escanear depósitos manualmente
  async scanDeposits(req, res) {
    if (!['admin', 'super_admin'].includes(req.user.rol)) {
      throw new AppError(403, errorCodes.ADMIN_FORBIDDEN, 'No autorizado');
    }

    const results = await BlockchainJobManager.runDepositScanJob();

    res.json({
      success: true,
      message: 'Escaneo de depósitos completado',
      data: results
    });
  }

  // POST /api/system/process-withdrawals - Procesar retiros manualmente
  async processWithdrawals(req, res) {
    if (!['admin', 'super_admin'].includes(req.user.rol)) {
      throw new AppError(403, errorCodes.ADMIN_FORBIDDEN, 'No autorizado');
    }

    const results = await BlockchainJobManager.runWithdrawalProcessJob();

    res.json({
      success: true,
      message: 'Procesamiento de retiros completado',
      data: results
    });
  }

  // POST /api/system/update-confirmations - Actualizar confirmaciones manualmente
  async updateConfirmations(req, res) {
    if (!['admin', 'super_admin'].includes(req.user.rol)) {
      throw new AppError(403, errorCodes.ADMIN_FORBIDDEN, 'No autorizado');
    }

    const results = await BlockchainJobManager.runConfirmationUpdateJob();

    res.json({
      success: true,
      message: 'Actualización de confirmaciones completada',
      data: results
    });
  }

  // GET /api/system/blockchain-status - Estado de los servicios blockchain
  async getBlockchainStatus(req, res) {
    if (!['admin', 'super_admin'].includes(req.user.rol)) {
      throw new AppError(403, errorCodes.ADMIN_FORBIDDEN, 'No autorizado');
    }

    const status = {
      ethereum: {
        connected: false,
        lastBlock: null,
        error: null
      },
      bsc: {
        connected: false,
        lastBlock: null,
        error: null
      },
      bitcoin: {
        connected: false,
        lastBlock: null,
        error: null
      }
    };

    // Verificar estado de cada red
    for (const [network, service] of Object.entries(BlockchainServiceManager.services)) {
      try {
        if (network === 'bitcoin') {
          status[network].connected = true;
          status[network].lastBlock = 'N/A';
        } else {
          const blockNumber = await service.provider.getBlockNumber();
          status[network].connected = true;
          status[network].lastBlock = blockNumber;
        }
      } catch (error) {
        status[network].error = error.message;
      }
    }

    res.json({
      success: true,
      data: status
    });
  }

  // =================== ENDPOINTS DE CONSULTA ===================

  // GET /api/transactions/tx/:hash - Buscar transacción por hash
  async getTransactionByHash(req, res) {
    const { hash } = req.params;

    const transaccion = await TransaccionBlockchain.getByTxHash(hash);

    if (!transaccion) {
      throw new AppError(404, errorCodes.TRANSACTION_NOT_FOUND, 'Transacción no encontrada');
    }

    // Solo el propietario o admin puede ver la transacción
    const userId = req.user.id;
    const userRole = req.user.rol;

    if (transaccion.userId !== userId && !['admin', 'super_admin'].includes(userRole)) {
      throw new AppError(403, errorCodes.TRANSACTION_FORBIDDEN, 'No autorizado para ver esta transacción');
    }

    res.json({
      success: true,
      data: transaccion
    });
  }
}

module.exports = new TransaccionBlockchainController();
