// controllers/transaccionBlockchain.controller.js
const { BlockchainTransaction, User, Crypto, UserBalance, DepositAddress } = require('../models');
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
const authz = require('../utils/authz');
const businessConfig = require('../modules/config/businessConfig');

class TransaccionBlockchainController {
  // =================== ENDPOINTS PARA USUARIOS ===================

  // GET /api/transactions/my - Obtener transacciones del usuario
  async getMyTransactions(req, res) {
    const userId = req.user.id;
    const filters = {
      type: req.query.type,
      status: req.query.status,
      cryptoId: req.query.cryptoId,
      fechaDesde: req.query.fechaDesde,
      fechaHasta: req.query.fechaHasta,
      limit: req.query.limit || 20,
      offset: req.query.offset || 0
    };

    const result = await BlockchainTransaction.getByUser(userId, filters);

    res.json({
      success: true,
      data: result
    });
  }

  // GET /api/transactions/:id - Obtener transacción específica
  async getTransaction(req, res) {
    const { id } = req.params;
    const userId = req.user.id;

    const transaccion = await BlockchainTransaction.getById(id);

    if (!transaccion) {
      throw new AppError(404, errorCodes.TRANSACTION_NOT_FOUND, 'Transacción no encontrada');
    }

    // Solo el propietario o admin puede ver la transacción
    if (!authz.canAccessResource(req.user, transaccion.userId)) {
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
    const { cryptoId, amount, destinationAddress } = req.body;

    // Cooldown de retiros tras un cambio de email reciente (Radar #14, anti
    // account-takeover): mientras esté vigente, no se crean retiros. Fail-fast,
    // antes de cualquier validación de network.
    const solicitante = await User.findByPk(userId, { attributes: ['withdrawalCooldownUntil'] });
    if (solicitante && solicitante.withdrawalCooldownUntil && new Date() < solicitante.withdrawalCooldownUntil) {
      throw new AppError(403, errorCodes.WITHDRAWAL_COOLDOWN,
        'Retiros temporalmente bloqueados tras un cambio de email reciente. Intentá más tarde.');
    }

    // Validar retiro
    const validation = await BlockchainTransaction.validateWithdrawal(
      userId,
      cryptoId,
      amount,
      destinationAddress
    );

    if (!validation.valid) {
      throw new AppError(400, errorCodes.WITHDRAWAL_VALIDATION_FAILED, validation.message);
    }

    // Validar dirección con el servicio de blockchain
    const blockchainService = BlockchainServiceManager.getService(validation.crypto.network);
    const isValidAddress = await blockchainService.validateAddress(destinationAddress);

    if (!isValidAddress) {
      throw new AppError(400, errorCodes.WITHDRAWAL_INVALID_ADDRESS, 'Dirección de destino inválida');
    }

    // Crear retiro. El body se arma UNA vez dentro del hook `finalize` (que corre
    // en la tx del retiro) y se envía verbatim, así el response y el que se guarda
    // para replay de idempotencia son idénticos.
    // Confirmaciones requeridas: config de negocio (Radar #13), con el default
    // previo como fallback (sin fila sembrada, comportamiento idéntico). Editable
    // desde /config por un operador (clave `confirmaciones.<network>`).
    const network = validation.crypto.network;
    const requiredConfirmations = await businessConfig.getNumber(
      `confirmaciones.${network}`, network === 'ethereum' ? 12 : 6
    );

    let responseBody;
    await BlockchainTransaction.createWithdrawal({
      userId,
      cryptoId,
      amount: parseFloat(amount),
      destinationAddress,
      requiredConfirmations
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
  // (no parseFloat). Se re-adjunta `crypto` (solo las activas) por lookup.
  // Ya no hay `id` de fila ni `updated_at`; las criptos sin saldo no se listan.
  async getMyBalances(req, res) {
    const userId = req.user.id;

    const balances = await UserBalance.getByUserId(userId);
    const criptomonedas = await Crypto.findAll({
      where: { id: balances.map((b) => b.cryptoId), active: true },
      attributes: ['id', 'symbol', 'name', 'network', 'decimals']
    });
    const criptoPorId = new Map(criptomonedas.map((c) => [c.id, c]));

    const balancesConTotal = balances
      .filter((b) => criptoPorId.has(b.cryptoId)) // solo criptos activas
      .map((b) => ({
        crypto: criptoPorId.get(b.cryptoId),
        availableBalance: b.availableBalance,
        blockedBalance: b.blockedBalance,
        totalBalance: money.add(b.availableBalance, b.blockedBalance)
      }))
      .sort((a, b) => a.crypto.symbol.localeCompare(b.crypto.symbol));

    res.json({
      success: true,
      data: balancesConTotal
    });
  }

  // GET /api/transactions/deposit-address/:cryptoId - Obtener dirección de depósito
  async getDepositAddress(req, res) {
    const userId = req.user.id;
    const { cryptoId } = req.params;

    // Verificar que la criptomoneda existe y está active
    const crypto = await Crypto.findByPk(cryptoId);
    if (!crypto || !crypto.active) {
      throw new AppError(404, errorCodes.DEPOSIT_CRYPTO_NOT_FOUND, 'Criptomoneda no encontrada o inactiva');
    }

    // ✅ CORRECCIÓN: Usar DepositAddress correctamente
    let address;

    try {
      address = await DepositAddress.getByUserAndCrypto(userId, cryptoId);
    } catch (error) {
      console.error('Error buscando dirección existente:', error.message);
    }

    if (!address) {
      // Generate new address — if this fails it is a server-side error (no safe recovery),
      // so throw AppError with a safe message rather than leaking the internal error.
      try {
        address = await DepositAddress.generateAddressForUser(userId, cryptoId);
      } catch (generateError) {
        console.error('Error generando nueva dirección:', generateError.message);
        throw new AppError(500, errorCodes.DEPOSIT_ADDRESS_GENERATION_FAILED, 'Error generando dirección de depósito');
      }
    }

    // ✅ CORRECCIÓN: Validar que la dirección se generó correctamente
    if (!address || !address.address) {
      throw new AppError(500, errorCodes.DEPOSIT_ADDRESS_GENERATION_FAILED, 'No se pudo obtener dirección de depósito');
    }

    res.json({
      success: true,
      data: {
        address: address.address,
        crypto: address.crypto || crypto,
        qrCode: `${crypto.symbol}:${address.address}`,
        derivationIndex: address.derivationIndex,
        metadata: {
          createdAt: address.created_at,
          network: crypto.network,
          confirmationsRequired: address.requiredConfirmations ||
            (crypto.network === 'bitcoin' ? 3 :
            crypto.network === 'ethereum' ? 12 : 6)
        },
        mensaje: `Esta es tu dirección para depósitos de ${crypto.symbol}. Los depósitos se acreditarán automáticamente después de las confirmaciones requeridas.`
      }
    });
  }

  // =================== ENDPOINTS ADMINISTRATIVOS ===================

  // GET /api/admin/transactions - Obtener todas las transacciones (admin)
  async getAllTransactions(req, res) {
    if (!authz.isAdmin(req.user)) {
      throw new AppError(403, errorCodes.ADMIN_FORBIDDEN, 'No autorizado');
    }

    const filters = {
      type: req.query.type,
      status: req.query.status,
      userId: req.query.userId,
      cryptoId: req.query.cryptoId,
      requiresApproval: req.query.requiresApproval,
      montoMin: req.query.montoMin,
      montoMax: req.query.montoMax,
      fechaDesde: req.query.fechaDesde,
      fechaHasta: req.query.fechaHasta,
      limit: req.query.limit || 50,
      offset: req.query.offset || 0
    };

    const result = await BlockchainTransaction.getAllWithFilters(filters);

    res.json({
      success: true,
      data: result
    });
  }

  // GET /api/admin/transactions/pending - Obtener transacciones pendientes
  async getPendingTransactions(req, res) {
    if (!authz.isAdmin(req.user)) {
      throw new AppError(403, errorCodes.ADMIN_FORBIDDEN, 'No autorizado');
    }

    const pendingDeposits = await BlockchainTransaction.getPendingDeposits();
    const pendingWithdrawals = await BlockchainTransaction.getPendingWithdrawals();

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
    if (!authz.isAdmin(req.user)) {
      throw new AppError(403, errorCodes.ADMIN_FORBIDDEN, 'No autorizado');
    }

    const { id } = req.params;
    const adminId = req.user.id;

    const transaccion = await BlockchainTransaction.findByPk(id);
    if (!transaccion) {
      throw new AppError(404, errorCodes.TRANSACTION_NOT_FOUND, 'Transacción no encontrada');
    }

    if (transaccion.status !== 'pending') {
      throw new AppError(400, errorCodes.TRANSACTION_INVALID_STATE, 'Solo se pueden aprobar transacciones pendientes');
    }

    await BlockchainTransaction.update(
      {
        approvedBy: adminId,
        approvalDate: new Date(),
        requiresApproval: false,
        status: 'processing'
      },
      { where: { id } }
    );

    const updatedTransaction = await BlockchainTransaction.getById(id);

    res.json({
      success: true,
      message: 'Transacción aprobada exitosamente',
      data: updatedTransaction
    });
  }

  // POST /api/admin/transactions/:id/reject - Rechazar transacción
  async rejectTransaction(req, res) {
    if (!authz.isAdmin(req.user)) {
      throw new AppError(403, errorCodes.ADMIN_FORBIDDEN, 'No autorizado');
    }

    const { id } = req.params;
    const { razon } = req.body;

    const transaccion = await BlockchainTransaction.findByPk(id);
    if (!transaccion) {
      throw new AppError(404, errorCodes.TRANSACTION_NOT_FOUND, 'Transacción no encontrada');
    }

    if (transaccion.type === 'withdrawal') {
      await BlockchainTransaction.failWithdrawal(id, razon || 'Rechazado por administrador');
    } else {
      await BlockchainTransaction.update(
        { status: 'failed' },
        { where: { id } }
      );
    }

    const updatedTransaction = await BlockchainTransaction.getById(id);

    res.json({
      success: true,
      message: 'Transacción rechazada exitosamente',
      data: updatedTransaction
    });
  }

  // GET /api/admin/transactions/stats - Estadísticas de transacciones
  async getTransactionStats(req, res) {
    if (!authz.isAdmin(req.user)) {
      throw new AppError(403, errorCodes.ADMIN_FORBIDDEN, 'No autorizado');
    }

    const filters = {
      fechaDesde: req.query.fechaDesde,
      fechaHasta: req.query.fechaHasta
    };

    const stats = await BlockchainTransaction.getStats(filters);

    res.json({
      success: true,
      data: stats
    });
  }

  // =================== ENDPOINTS DE SISTEMA ===================

  // POST /api/system/scan-deposits - Escanear depósitos manualmente
  async scanDeposits(req, res) {
    if (!authz.isAdmin(req.user)) {
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
    if (!authz.isAdmin(req.user)) {
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
    if (!authz.isAdmin(req.user)) {
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
    if (!authz.isAdmin(req.user)) {
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

    // Verificar estado de cada network
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

    const transaccion = await BlockchainTransaction.getByTxHash(hash);

    if (!transaccion) {
      throw new AppError(404, errorCodes.TRANSACTION_NOT_FOUND, 'Transacción no encontrada');
    }

    // Solo el propietario o admin puede ver la transacción
    const userId = req.user.id;

    if (!authz.canAccessResource(req.user, transaccion.userId)) {
      throw new AppError(403, errorCodes.TRANSACTION_FORBIDDEN, 'No autorizado para ver esta transacción');
    }

    res.json({
      success: true,
      data: transaccion
    });
  }
}

module.exports = new TransaccionBlockchainController();
