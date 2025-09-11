// controllers/transaccionBlockchain.controller.js
const { TransaccionBlockchain, Usuario, Criptomoneda, BalanceUsuario } = require('../models');
const BlockchainServiceManager = require('../services/blockchain');
const { validationResult } = require('express-validator');

class TransaccionBlockchainController {
  // =================== ENDPOINTS PARA USUARIOS ===================

  // GET /api/transactions/my - Obtener transacciones del usuario
  async getMyTransactions(req, res) {
    try {
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
    } catch (error) {
      console.error('Error obteniendo transacciones del usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // GET /api/transactions/:id - Obtener transacción específica
  async getTransaction(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.rol;

      const transaccion = await TransaccionBlockchain.getById(id);

      if (!transaccion) {
        return res.status(404).json({
          success: false,
          message: 'Transacción no encontrada'
        });
      }

      // Solo el propietario o admin puede ver la transacción
      if (transaccion.userId !== userId && !['admin', 'super_admin'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'No autorizado para ver esta transacción'
        });
      }

      res.json({
        success: true,
        data: transaccion
      });
    } catch (error) {
      console.error('Error obteniendo transacción:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // POST /api/transactions/withdraw - Crear retiro
  async createWithdrawal(req, res) {
    try {
      // Validar datos de entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: errors.array()
        });
      }

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
        return res.status(400).json({
          success: false,
          message: validation.message
        });
      }

      // Validar dirección con el servicio de blockchain
      const blockchainService = BlockchainServiceManager.getService(validation.criptomoneda.red);
      const isValidAddress = await blockchainService.validateAddress(direccionDestino);

      if (!isValidAddress) {
        return res.status(400).json({
          success: false,
          message: 'Dirección de destino inválida'
        });
      }

      // Crear retiro
      const retiro = await TransaccionBlockchain.createWithdrawal({
        userId,
        criptomonedaId,
        cantidad: parseFloat(cantidad),
        direccionDestino,
        confirmacionesRequeridas: validation.criptomoneda.red === 'bitcoin' ? 6 : 
                                   validation.criptomoneda.red === 'ethereum' ? 12 : 6
      });

      res.status(201).json({
        success: true,
        message: 'Retiro creado exitosamente',
        data: retiro
      });
    } catch (error) {
      console.error('Error creando retiro:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // GET /api/transactions/balances - Obtener balances del usuario
  async getMyBalances(req, res) {
    try {
      const userId = req.user.id;

      const balances = await BalanceUsuario.findAll({
        where: { userId },
        include: [
          {
            model: Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'red', 'decimales'],
            where: { activa: true }
          }
        ],
        order: [['criptomoneda', 'symbol', 'ASC']]
      });

      // Calcular balance total por criptomoneda
      const balancesConTotal = balances.map(balance => ({
        id: balance.id,
        criptomoneda: balance.criptomoneda,
        balanceDisponible: parseFloat(balance.balanceDisponible),
        balanceBloqueado: parseFloat(balance.balanceBloqueado),
        balanceTotal: parseFloat(balance.balanceDisponible) + parseFloat(balance.balanceBloqueado),
        updatedAt: balance.updated_at
      }));

      res.json({
        success: true,
        data: balancesConTotal
      });
    } catch (error) {
      console.error('Error obteniendo balances:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // GET /api/transactions/deposit-address/:criptomonedaId - Obtener dirección de depósito
  async getDepositAddress(req, res) {
    try {
      const userId = req.user.id;
      const { criptomonedaId } = req.params;

      // Verificar que la criptomoneda existe y está activa
      const criptomoneda = await Criptomoneda.findByPk(criptomonedaId);
      if (!criptomoneda || !criptomoneda.activa) {
        return res.status(404).json({
          success: false,
          message: 'Criptomoneda no encontrada o inactiva'
        });
      }

      // Buscar dirección existente o crear una nueva
      const DireccionDeposito = require('../models').DireccionDeposito;
      let direccion = await DireccionDeposito.getByUserAndCrypto(userId, criptomonedaId);

      if (!direccion) {
        // Generar nueva dirección
        direccion = await DireccionDeposito.generateAddressForUser(userId, criptomonedaId);
      }

      res.json({
        success: true,
        data: {
          direccion: direccion.direccion,
          criptomoneda: direccion.criptomoneda,
          qrCode: `${criptomoneda.symbol}:${direccion.direccion}`, // Para generar QR
          mensaje: `Esta es tu dirección para depósitos de ${criptomoneda.symbol}. Los depósitos se acreditarán automáticamente después de las confirmaciones requeridas.`
        }
      });
    } catch (error) {
      console.error('Error obteniendo dirección de depósito:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // =================== ENDPOINTS ADMINISTRATIVOS ===================

  // GET /api/admin/transactions - Obtener todas las transacciones (admin)
  async getAllTransactions(req, res) {
    try {
      if (!['admin', 'super_admin'].includes(req.user.rol)) {
        return res.status(403).json({
          success: false,
          message: 'No autorizado'
        });
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
    } catch (error) {
      console.error('Error obteniendo todas las transacciones:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // GET /api/admin/transactions/pending - Obtener transacciones pendientes
  async getPendingTransactions(req, res) {
    try {
      if (!['admin', 'super_admin'].includes(req.user.rol)) {
        return res.status(403).json({
          success: false,
          message: 'No autorizado'
        });
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
    } catch (error) {
      console.error('Error obteniendo transacciones pendientes:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // POST /api/admin/transactions/:id/approve - Aprobar transacción
  async approveTransaction(req, res) {
    try {
      if (!['admin', 'super_admin'].includes(req.user.rol)) {
        return res.status(403).json({
          success: false,
          message: 'No autorizado'
        });
      }

      const { id } = req.params;
      const adminId = req.user.id;

      const transaccion = await TransaccionBlockchain.findByPk(id);
      if (!transaccion) {
        return res.status(404).json({
          success: false,
          message: 'Transacción no encontrada'
        });
      }

      if (transaccion.estado !== 'pendiente') {
        return res.status(400).json({
          success: false,
          message: 'Solo se pueden aprobar transacciones pendientes'
        });
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
    } catch (error) {
      console.error('Error aprobando transacción:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // POST /api/admin/transactions/:id/reject - Rechazar transacción
  async rejectTransaction(req, res) {
    try {
      if (!['admin', 'super_admin'].includes(req.user.rol)) {
        return res.status(403).json({
          success: false,
          message: 'No autorizado'
        });
      }

      const { id } = req.params;
      const { razon } = req.body;

      const transaccion = await TransaccionBlockchain.findByPk(id);
      if (!transaccion) {
        return res.status(404).json({
          success: false,
          message: 'Transacción no encontrada'
        });
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
    } catch (error) {
      console.error('Error rechazando transacción:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // GET /api/admin/transactions/stats - Estadísticas de transacciones
  async getTransactionStats(req, res) {
    try {
      if (!['admin', 'super_admin'].includes(req.user.rol)) {
        return res.status(403).json({
          success: false,
          message: 'No autorizado'
        });
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
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // =================== ENDPOINTS DE SISTEMA ===================

  // POST /api/system/scan-deposits - Escanear depósitos manualmente
  async scanDeposits(req, res) {
    try {
      if (!['admin', 'super_admin'].includes(req.user.rol)) {
        return res.status(403).json({
          success: false,
          message: 'No autorizado'
        });
      }

      const results = await BlockchainServiceManager.scanAllNetworksForDeposits();

      res.json({
        success: true,
        message: 'Escaneo de depósitos completado',
        data: results
      });
    } catch (error) {
      console.error('Error escaneando depósitos:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // POST /api/system/process-withdrawals - Procesar retiros manualmente
  async processWithdrawals(req, res) {
    try {
      if (!['admin', 'super_admin'].includes(req.user.rol)) {
        return res.status(403).json({
          success: false,
          message: 'No autorizado'
        });
      }

      const results = await BlockchainServiceManager.processAllPendingWithdrawals();

      res.json({
        success: true,
        message: 'Procesamiento de retiros completado',
        data: results
      });
    } catch (error) {
      console.error('Error procesando retiros:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // POST /api/system/update-confirmations - Actualizar confirmaciones manualmente
  async updateConfirmations(req, res) {
    try {
      if (!['admin', 'super_admin'].includes(req.user.rol)) {
        return res.status(403).json({
          success: false,
          message: 'No autorizado'
        });
      }

      const results = await BlockchainServiceManager.updateAllConfirmations();

      res.json({
        success: true,
        message: 'Actualización de confirmaciones completada',
        data: results
      });
    } catch (error) {
      console.error('Error actualizando confirmaciones:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // GET /api/system/blockchain-status - Estado de los servicios blockchain
  async getBlockchainStatus(req, res) {
    try {
      if (!['admin', 'super_admin'].includes(req.user.rol)) {
        return res.status(403).json({
          success: false,
          message: 'No autorizado'
        });
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
    } catch (error) {
      console.error('Error obteniendo estado blockchain:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // =================== ENDPOINTS DE CONSULTA ===================

  // GET /api/transactions/tx/:hash - Buscar transacción por hash
  async getTransactionByHash(req, res) {
    try {
      const { hash } = req.params;
      
      const transaccion = await TransaccionBlockchain.getByTxHash(hash);
      
      if (!transaccion) {
        return res.status(404).json({
          success: false,
          message: 'Transacción no encontrada'
        });
      }

      // Solo el propietario o admin puede ver la transacción
      const userId = req.user.id;
      const userRole = req.user.rol;
      
      if (transaccion.userId !== userId && !['admin', 'super_admin'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'No autorizado para ver esta transacción'
        });
      }

      res.json({
        success: true,
        data: transaccion
      });
    } catch (error) {
      console.error('Error buscando transacción por hash:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }
}

module.exports = new TransaccionBlockchainController();