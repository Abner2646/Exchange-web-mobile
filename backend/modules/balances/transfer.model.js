const initTransfer = require('./transfer.entity.js');
const { Op } = require('sequelize');
const emailService = require('../../services/email.service');

function createTransferModel(sequelize) {
  const Transfer = initTransfer(sequelize);

  // Método para generar código de verificación
  Transfer.prototype.generateVerificationCode = function() {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiration = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    this.verificationCode = code;
    this.codeExpiration = expiration;

    return code;
  };

  // Validar código de verificación
  Transfer.prototype.validateCode = function(code) {
    return this.verificationCode === code &&
           this.codeExpiration &&
           new Date() < this.codeExpiration;
  };

  // Métodos estáticos
  Transfer.createTransfer = async (transferData, options = {}) => {
    try {
      const {
        senderId,
        recipientId,
        cryptoId,
        amount,
        concept = ''
      } = transferData;

      // Validaciones básicas
      if (senderId === recipientId) {
        throw new Error('No puedes transferir a tu misma cuenta');
      }

      if (amount <= 0) {
        throw new Error('La cantidad debe ser mayor a 0');
      }

      const transfer = await Transfer.create({
        senderId,
        recipientId,
        cryptoId,
        amount,
        concept,
        status: 'pending'
      }, options);

      // Generar código de verificación
      const code = transfer.generateVerificationCode();
      await transfer.save(options);

      return { transfer, code };
    } catch (error) {
      throw new Error(`Error al crear transferencia: ${error.message}`);
    }
  };

  // Obtener transferencia por ID
  Transfer.getById = async (id, options = {}) => {
    try {
      const transfer = await Transfer.findByPk(id, {
        include: [
          {
            association: 'sender',
            attributes: ['id', 'email', 'username']
          },
          {
            association: 'recipient',
            attributes: ['id', 'email', 'username']
          },
          {
            association: 'crypto', // Alias actualizado
            attributes: ['id', 'symbol', 'name', 'network']
          }
        ],
        ...options
      });
      return transfer;
    } catch (error) {
      throw new Error(`Error al obtener transferencia: ${error.message}`);
    }
  };

  // Obtener transferencias de un usuario
  Transfer.getByUser = async (userId, filters = {}) => {
    try {
      const {
        direction = 'all', // 'sent', 'received', 'all'
        status,
        cryptoId,
        page = 1,
        limit = 20,
        dateFrom,
        dateTo
      } = filters;

      const where = {};
      const offset = (page - 1) * limit;

      // Filtro por usuario
      if (direction === 'sent') {
        where.senderId = userId;
      } else if (direction === 'received') {
        where.recipientId = userId;
      } else {
        where[Op.or] = [
          { senderId: userId },
          { recipientId: userId }
        ];
      }

      // Filtros adicionales
      if (status) where.status = status;
      if (cryptoId) where.cryptoId = cryptoId;

      // Filtros de fecha
      if (dateFrom || dateTo) {
        where.created_at = {};
        if (dateFrom) where.created_at[Op.gte] = new Date(dateFrom);
        if (dateTo) where.created_at[Op.lte] = new Date(dateTo);
      }

      const { count, rows } = await Transfer.findAndCountAll({
        where,
        include: [
          {
            association: 'sender',
            attributes: ['id', 'email', 'username']
          },
          {
            association: 'recipient',
            attributes: ['id', 'email', 'username']
          },
          {
            association: 'crypto',
            attributes: ['id', 'symbol', 'name']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset,
        distinct: true
      });

      return {
        transfers: rows,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      };
    } catch (error) {
      throw new Error(`Error al obtener transferencias: ${error.message}`);
    }
  };

  // Procesar transferencia (verificar fondos y ejecutar)
  Transfer.processTransfer = async (id, verificationCode, options = {}) => {
    const t = options.transaction || await sequelize.transaction();

    try {
      const transfer = await Transfer.getById(id, { transaction: t });

      if (!transfer) {
        throw new Error('Transferencia no encontrada');
      }

      if (transfer.status !== 'pending') {
        throw new Error(`La transferencia ya fue ${transfer.status}`);
      }

      // Verificar código de verificación
      if (!transfer.validateCode(verificationCode)) {
        throw new Error('Código de verificación inválido o expirado');
      }

      const { UserBalance, User } = require('../../models/index');

      // Verificar que el remitente tenga fondos suficientes
      const senderBalance = await UserBalance.getByUserAndCrypto(
        transfer.senderId,
        transfer.cryptoId,
        { transaction: t }
      );

      if (!senderBalance || parseFloat(senderBalance.availableBalance) < parseFloat(transfer.amount)) {
        throw new Error('Fondos insuficientes para completar la transferencia');
      }

      // Obtener información de usuarios para notificaciones
      const sender = await User.findByPk(transfer.senderId, { transaction: t });
      const recipient = await User.findByPk(transfer.recipientId, { transaction: t });

      if (!sender || !sender.active) {
        throw new Error('Usuario remitente no válido');
      }

      if (!recipient || !recipient.active) {
        throw new Error('Usuario destinatario no válido');
      }

      // Paso D: transferencia interna como UN asiento user↔user (sin suspense).
      // (Nota: este método de modelo NO está cableado a ninguna ruta — el flujo
      // vivo es el controller processTransfer; se corrige igual para no
      // dejar una duplicación con el bug de pasar { transaction } como 5º arg.)
      const { transferInternal } = require('./ledger/operations');
      await transferInternal({
        remitenteId: transfer.senderId,
        destinatarioId: transfer.recipientId,
        criptomonedaId: transfer.cryptoId,
        cantidad: String(transfer.amount),
        referencia: `transferencia:${transfer.id}`,
      }, t);

      // Actualizar estado de la transferencia
      transfer.status = 'completed';
      transfer.verificationCode = null;
      transfer.codeExpiration = null;
      await transfer.save({ transaction: t });

      if (!options.transaction) {
        await t.commit();
      }

      return {
        transfer,
        sender: {
          id: sender.id,
          email: sender.email,
          username: sender.username
        },
        recipient: {
          id: recipient.id,
          email: recipient.email,
          username: recipient.username
        }
      };
    } catch (error) {
      if (!options.transaction) {
        await t.rollback();
      }
      throw new Error(`Error al procesar transferencia: ${error.message}`);
    }
  };

  // Cancelar transferencia
  Transfer.cancelTransfer = async (id, userId, options = {}) => {
    try {
      const transfer = await Transfer.getById(id, options);

      if (!transfer) {
        throw new Error('Transferencia no encontrada');
      }

      if (transfer.senderId !== userId) {
        throw new Error('Solo el remitente puede cancelar la transferencia');
      }

      if (transfer.status !== 'pending') {
        throw new Error(`No se puede cancelar una transferencia ${transfer.status}`);
      }

      transfer.status = 'cancelled';
      transfer.verificationCode = null;
      transfer.codeExpiration = null;
      await transfer.save(options);

      return transfer;
    } catch (error) {
      throw new Error(`Error al cancelar transferencia: ${error.message}`);
    }
  };

  // Reenviar código de verificación
  Transfer.resendCode = async (id, options = {}) => {
    try {
      const transfer = await Transfer.getById(id, options);

      if (!transfer) {
        throw new Error('Transferencia no encontrada');
      }

      if (transfer.status !== 'pending') {
        throw new Error('Solo se puede reenviar código para transferencias pendientes');
      }

      const code = transfer.generateVerificationCode();
      await transfer.save(options);

      return { transfer, code };
    } catch (error) {
      throw new Error(`Error al reenviar código: ${error.message}`);
    }
  };

  // Métodos administrativos
  Transfer.getAll = async (filters = {}) => {
    try {
      const {
        status,
        cryptoId,
        senderId,
        recipientId,
        page = 1,
        limit = 50,
        dateFrom,
        dateTo
      } = filters;

      const where = {};
      const offset = (page - 1) * limit;

      if (status) where.status = status;
      if (cryptoId) where.cryptoId = cryptoId;
      if (senderId) where.senderId = senderId;
      if (recipientId) where.recipientId = recipientId;

      if (dateFrom || dateTo) {
        where.created_at = {};
        if (dateFrom) where.created_at[Op.gte] = new Date(dateFrom);
        if (dateTo) where.created_at[Op.lte] = new Date(dateTo);
      }

      const { count, rows } = await Transfer.findAndCountAll({
        where,
        include: [
          {
            association: 'sender',
            attributes: ['id', 'email', 'username']
          },
          {
            association: 'recipient',
            attributes: ['id', 'email', 'username']
          },
          {
            association: 'crypto',
            attributes: ['id', 'symbol', 'name']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset,
        distinct: true
      });

      return {
        transfers: rows,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      };
    } catch (error) {
      throw new Error(`Error al obtener todas las transferencias: ${error.message}`);
    }
  };

  // Estadísticas
  Transfer.getStats = async (filters = {}) => {
    try {
      const where = {};

      if (filters.dateFrom || filters.dateTo) {
        where.created_at = {};
        if (filters.dateFrom) where.created_at[Op.gte] = new Date(filters.dateFrom);
        if (filters.dateTo) where.created_at[Op.lte] = new Date(filters.dateTo);
      }

      const stats = await Transfer.findAll({
        attributes: [
          'status',
          'cryptoId',
          [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
          [sequelize.fn('SUM', sequelize.col('amount')), 'totalVolume']
        ],
        where,
        group: ['status', 'cryptoId'],
        raw: true
      });

      return stats;
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  };

  return Transfer;
}

module.exports = createTransferModel;
