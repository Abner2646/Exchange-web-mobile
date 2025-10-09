const initTransferencia = require('./entities/transferencia.entity.js');
const { Op } = require('sequelize');
const emailService = require('../services/email.service');

function createTransferenciaModel(sequelize) {
  const Transferencia = initTransferencia(sequelize);

  // Método para generar código de verificación
  Transferencia.prototype.generarCodigoVerificacion = function() {
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
    
    this.codigoVerificacion = codigo;
    this.expiracionCodigo = expiracion;
    
    return codigo;
  };

  // Validar código de verificación
  Transferencia.prototype.validarCodigo = function(codigo) {
    return this.codigoVerificacion === codigo && 
           this.expiracionCodigo && 
           new Date() < this.expiracionCodigo;
  };

  // Métodos estáticos
    Transferencia.crearTransferencia = async (transferenciaData, options = {}) => {
    try {
        const {
        usuarioRemitenteId,
        usuarioDestinatarioId,
        criptomonedaId,
        cantidad,
        concepto = ''
        } = transferenciaData;

        // Validaciones básicas
        if (usuarioRemitenteId === usuarioDestinatarioId) {
        throw new Error('No puedes transferir a tu misma cuenta');
        }

        if (cantidad <= 0) {
        throw new Error('La cantidad debe ser mayor a 0');
        }

        const transferencia = await Transferencia.create({
        usuarioRemitenteId,
        usuarioDestinatarioId,
        criptomonedaId,
        cantidad,
        concepto,
        estado: 'pendiente'
        }, options);

        // Generar código de verificación
        const codigo = transferencia.generarCodigoVerificacion();
        await transferencia.save(options);

        return { transferencia, codigo };
    } catch (error) {
        throw new Error(`Error al crear transferencia: ${error.message}`);
    }
    };

  // Obtener transferencia por ID
    Transferencia.getById = async (id, options = {}) => {
    try {
        const transferencia = await Transferencia.findByPk(id, {
        include: [
            {
            association: 'remitente',
            attributes: ['id', 'email', 'username']
            },
            {
            association: 'destinatario', 
            attributes: ['id', 'email', 'username']
            },
            {
            association: 'criptomonedaTransferencia', // Alias actualizado
            attributes: ['id', 'symbol', 'nombre', 'red']
            }
        ],
        ...options
        });
        return transferencia;
    } catch (error) {
        throw new Error(`Error al obtener transferencia: ${error.message}`);
    }
    };

  // Obtener transferencias de un usuario
  Transferencia.getByUsuario = async (usuarioId, filters = {}) => {
    try {
      const {
        tipo = 'todas', // 'enviadas', 'recibidas', 'todas'
        estado,
        criptomonedaId,
        page = 1,
        limit = 20,
        fechaDesde,
        fechaHasta
      } = filters;

      const where = {};
      const offset = (page - 1) * limit;

      // Filtro por usuario
      if (tipo === 'enviadas') {
        where.usuarioRemitenteId = usuarioId;
      } else if (tipo === 'recibidas') {
        where.usuarioDestinatarioId = usuarioId;
      } else {
        where[Op.or] = [
          { usuarioRemitenteId: usuarioId },
          { usuarioDestinatarioId: usuarioId }
        ];
      }

      // Filtros adicionales
      if (estado) where.estado = estado;
      if (criptomonedaId) where.criptomonedaId = criptomonedaId;

      // Filtros de fecha
      if (fechaDesde || fechaHasta) {
        where.created_at = {};
        if (fechaDesde) where.created_at[Op.gte] = new Date(fechaDesde);
        if (fechaHasta) where.created_at[Op.lte] = new Date(fechaHasta);
      }

      const { count, rows } = await Transferencia.findAndCountAll({
        where,
        include: [
          {
            association: 'remitente',
            attributes: ['id', 'email', 'username']
          },
          {
            association: 'destinatario',
            attributes: ['id', 'email', 'username']
          },
          {
            association: 'criptomonedaTransferencia',
            attributes: ['id', 'symbol', 'nombre']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset,
        distinct: true
      });

      return {
        transferencias: rows,
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
  Transferencia.procesarTransferencia = async (id, codigoVerificacion, options = {}) => {
    const t = options.transaction || await sequelize.transaction();
    
    try {
      const transferencia = await Transferencia.getById(id, { transaction: t });
      
      if (!transferencia) {
        throw new Error('Transferencia no encontrada');
      }

      if (transferencia.estado !== 'pendiente') {
        throw new Error(`La transferencia ya fue ${transferencia.estado}`);
      }

      // Verificar código de verificación
      if (!transferencia.validarCodigo(codigoVerificacion)) {
        throw new Error('Código de verificación inválido o expirado');
      }

      const { BalanceUsuario, Usuario } = require('./index');

      // Verificar que el remitente tenga fondos suficientes
      const balanceRemitente = await BalanceUsuario.getByUserAndCrypto(
        transferencia.usuarioRemitenteId,
        transferencia.criptomonedaId,
        { transaction: t }
      );

      if (!balanceRemitente || parseFloat(balanceRemitente.balanceDisponible) < parseFloat(transferencia.cantidad)) {
        throw new Error('Fondos insuficientes para completar la transferencia');
      }

      // Obtener información de usuarios para notificaciones
      const remitente = await Usuario.findByPk(transferencia.usuarioRemitenteId, { transaction: t });
      const destinatario = await Usuario.findByPk(transferencia.usuarioDestinatarioId, { transaction: t });

      if (!remitente || !remitente.activo) {
        throw new Error('Usuario remitente no válido');
      }

      if (!destinatario || !destinatario.activo) {
        throw new Error('Usuario destinatario no válido');
      }

      // Ejecutar la transferencia (restar del remitente, sumar al destinatario)
      await BalanceUsuario.updateBalance(
        transferencia.usuarioRemitenteId,
        transferencia.criptomonedaId,
        -transferencia.cantidad,
        'disponible',
        { transaction: t }
      );

      await BalanceUsuario.updateBalance(
        transferencia.usuarioDestinatarioId,
        transferencia.criptomonedaId,
        transferencia.cantidad,
        'disponible',
        { transaction: t }
      );

      // Actualizar estado de la transferencia
      transferencia.estado = 'completada';
      transferencia.codigoVerificacion = null;
      transferencia.expiracionCodigo = null;
      await transferencia.save({ transaction: t });

      if (!options.transaction) {
        await t.commit();
      }

      return { 
        transferencia,
        remitente: {
          id: remitente.id,
          email: remitente.email,
          username: remitente.username
        },
        destinatario: {
          id: destinatario.id,
          email: destinatario.email,
          username: destinatario.username
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
  Transferencia.cancelarTransferencia = async (id, usuarioId, options = {}) => {
    try {
      const transferencia = await Transferencia.getById(id, options);
      
      if (!transferencia) {
        throw new Error('Transferencia no encontrada');
      }

      if (transferencia.usuarioRemitenteId !== usuarioId) {
        throw new Error('Solo el remitente puede cancelar la transferencia');
      }

      if (transferencia.estado !== 'pendiente') {
        throw new Error(`No se puede cancelar una transferencia ${transferencia.estado}`);
      }

      transferencia.estado = 'cancelada';
      transferencia.codigoVerificacion = null;
      transferencia.expiracionCodigo = null;
      await transferencia.save(options);

      return transferencia;
    } catch (error) {
      throw new Error(`Error al cancelar transferencia: ${error.message}`);
    }
  };

  // Reenviar código de verificación
  Transferencia.reenviarCodigo = async (id, options = {}) => {
    try {
      const transferencia = await Transferencia.getById(id, options);
      
      if (!transferencia) {
        throw new Error('Transferencia no encontrada');
      }

      if (transferencia.estado !== 'pendiente') {
        throw new Error('Solo se puede reenviar código para transferencias pendientes');
      }

      const codigo = transferencia.generarCodigoVerificacion();
      await transferencia.save(options);

      return { transferencia, codigo };
    } catch (error) {
      throw new Error(`Error al reenviar código: ${error.message}`);
    }
  };

  // Métodos administrativos
  Transferencia.getAll = async (filters = {}) => {
    try {
      const {
        estado,
        criptomonedaId,
        usuarioRemitenteId,
        usuarioDestinatarioId,
        page = 1,
        limit = 50,
        fechaDesde,
        fechaHasta
      } = filters;

      const where = {};
      const offset = (page - 1) * limit;

      if (estado) where.estado = estado;
      if (criptomonedaId) where.criptomonedaId = criptomonedaId;
      if (usuarioRemitenteId) where.usuarioRemitenteId = usuarioRemitenteId;
      if (usuarioDestinatarioId) where.usuarioDestinatarioId = usuarioDestinatarioId;

      if (fechaDesde || fechaHasta) {
        where.created_at = {};
        if (fechaDesde) where.created_at[Op.gte] = new Date(fechaDesde);
        if (fechaHasta) where.created_at[Op.lte] = new Date(fechaHasta);
      }

      const { count, rows } = await Transferencia.findAndCountAll({
        where,
        include: [
          {
            association: 'remitente',
            attributes: ['id', 'email', 'username']
          },
          {
            association: 'destinatario',
            attributes: ['id', 'email', 'username']
          },
          {
            association: 'criptomonedaTransferencia',
            attributes: ['id', 'symbol', 'nombre']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset,
        distinct: true
      });

      return {
        transferencias: rows,
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
  Transferencia.getStats = async (filters = {}) => {
    try {
      const where = {};
      
      if (filters.fechaDesde || filters.fechaHasta) {
        where.created_at = {};
        if (filters.fechaDesde) where.created_at[Op.gte] = new Date(filters.fechaDesde);
        if (filters.fechaHasta) where.created_at[Op.lte] = new Date(filters.fechaHasta);
      }

      const stats = await Transferencia.findAll({
        attributes: [
          'estado',
          'criptomonedaId',
          [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
          [sequelize.fn('SUM', sequelize.col('cantidad')), 'volumenTotal']
        ],
        where,
        group: ['estado', 'criptomonedaId'],
        raw: true
      });

      return stats;
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  };

  return Transferencia;
}

module.exports = createTransferenciaModel;