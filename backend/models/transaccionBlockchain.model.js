// models/transaccionBlockchain.model.js
require('dotenv').config();
const initTransaccionBlockchain = require('./entities/transaccionBlockchain.entity');
const initBalanceUsuario = require('./entities/balanceUsuario.entity');
const { Op } = require('sequelize');

function createTransaccionBlockchainModel(sequelize) {
  const TransaccionBlockchain = initTransaccionBlockchain(sequelize);
  const BalanceUsuario = initBalanceUsuario(sequelize);

  // =================== MÉTODOS DE CONSULTA BÁSICOS ===================
  
  TransaccionBlockchain.getById = async (id) => {
    try {
      const transaccion = await TransaccionBlockchain.findByPk(id, {
        include: [
          {
            model: sequelize.models.Usuario,
            as: 'usuario',
            attributes: ['id', 'email', 'username', 'activo']
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'red', 'decimales']
          },
          {
            model: sequelize.models.Usuario,
            as: 'adminAprobador',
            attributes: ['id', 'email', 'username'],
            required: false
          }
        ]
      });
      return transaccion;
    } catch (error) {
      throw new Error(`Error al obtener transacción por ID: ${error.message}`);
    }
  };

  TransaccionBlockchain.getByTxHash = async (txHash) => {
    try {
      const transaccion = await TransaccionBlockchain.findOne({
        where: { txHash },
        include: [
          {
            model: sequelize.models.Usuario,
            as: 'usuario',
            attributes: ['id', 'email', 'username']
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'red']
          }
        ]
      });
      return transaccion;
    } catch (error) {
      throw new Error(`Error al obtener transacción por hash: ${error.message}`);
    }
  };

  TransaccionBlockchain.getByUser = async (userId, filters = {}) => {
    try {
      const whereClause = { userId };
      
      if (filters.tipo) whereClause.tipo = filters.tipo;
      if (filters.estado) whereClause.estado = filters.estado;
      if (filters.criptomonedaId) whereClause.criptomonedaId = filters.criptomonedaId;
      
      if (filters.fechaDesde || filters.fechaHasta) {
        whereClause.created_at = {};
        if (filters.fechaDesde) {
          whereClause.created_at[Op.gte] = new Date(filters.fechaDesde);
        }
        if (filters.fechaHasta) {
          whereClause.created_at[Op.lte] = new Date(filters.fechaHasta);
        }
      }

      const { count, rows } = await TransaccionBlockchain.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'red', 'decimales']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(filters.limit) || 50,
        offset: parseInt(filters.offset) || 0
      });

      return {
        transacciones: rows,
        total: count,
        page: Math.floor((parseInt(filters.offset) || 0) / (parseInt(filters.limit) || 50)) + 1,
        totalPages: Math.ceil(count / (parseInt(filters.limit) || 50))
      };
    } catch (error) {
      throw new Error(`Error al obtener transacciones por usuario: ${error.message}`);
    }
  };

  TransaccionBlockchain.getAllWithFilters = async (filters = {}) => {
    try {
      const whereClause = {};
      
      if (filters.tipo) whereClause.tipo = filters.tipo;
      if (filters.estado) whereClause.estado = filters.estado;
      if (filters.userId) whereClause.userId = filters.userId;
      if (filters.criptomonedaId) whereClause.criptomonedaId = filters.criptomonedaId;
      if (filters.requiereAprobacion !== undefined) {
        whereClause.requiereAprobacion = filters.requiereAprobacion === 'true';
      }
      
      if (filters.montoMin || filters.montoMax) {
        whereClause.cantidad = {};
        if (filters.montoMin) whereClause.cantidad[Op.gte] = parseFloat(filters.montoMin);
        if (filters.montoMax) whereClause.cantidad[Op.lte] = parseFloat(filters.montoMax);
      }

      if (filters.fechaDesde || filters.fechaHasta) {
        whereClause.created_at = {};
        if (filters.fechaDesde) {
          whereClause.created_at[Op.gte] = new Date(filters.fechaDesde);
        }
        if (filters.fechaHasta) {
          whereClause.created_at[Op.lte] = new Date(filters.fechaHasta);
        }
      }

      const { count, rows } = await TransaccionBlockchain.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: sequelize.models.Usuario,
            as: 'usuario',
            attributes: ['id', 'email', 'username']
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'red', 'decimales']
          },
          {
            model: sequelize.models.Usuario,
            as: 'adminAprobador',
            attributes: ['id', 'email', 'username'],
            required: false
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(filters.limit) || 50,
        offset: parseInt(filters.offset) || 0
      });

      return {
        transacciones: rows,
        total: count,
        page: Math.floor((parseInt(filters.offset) || 0) / (parseInt(filters.limit) || 50)) + 1,
        totalPages: Math.ceil(count / (parseInt(filters.limit) || 50))
      };
    } catch (error) {
      throw new Error(`Error al obtener transacciones con filtros: ${error.message}`);
    }
  };

  // =================== MÉTODOS PARA DEPÓSITOS ===================

  TransaccionBlockchain.createDeposit = async (data) => {
    const transaction = await sequelize.transaction();
    
    try {
      // Validar datos requeridos
      if (!data.userId || !data.criptomonedaId || !data.cantidad || !data.txHash) {
        throw new Error('Datos incompletos para crear depósito');
      }

      // Verificar que no existe ya una transacción con este hash
      const existingTx = await TransaccionBlockchain.findOne({
        where: { txHash: data.txHash },
        transaction
      });

      if (existingTx) {
        throw new Error('Ya existe una transacción con este hash');
      }

      // Crear la transacción de depósito
      const depositData = {
        ...data,
        tipo: 'deposito',
        estado: 'pendiente',
        confirmaciones: 0,
        requiereAprobacion: false
      };

      const nuevoDeposito = await TransaccionBlockchain.create(depositData, { transaction });
      await transaction.commit();

      return await TransaccionBlockchain.getById(nuevoDeposito.id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al crear depósito: ${error.message}`);
    }
  };

  TransaccionBlockchain.updateConfirmations = async (id, confirmaciones, newTxHash = null) => {
    const transaction = await sequelize.transaction();
    
    try {
      const transaccion = await TransaccionBlockchain.findByPk(id, {
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda'
          }
        ],
        transaction
      });

      if (!transaccion) {
        throw new Error('Transacción no encontrada');
      }

      const updateData = { confirmaciones };
      
      // Actualizar hash si se proporciona (para casos donde cambia el hash)
      if (newTxHash && newTxHash !== transaccion.txHash) {
        updateData.txHash = newTxHash;
      }

      // Determinar nuevo estado basado en confirmaciones
      if (confirmaciones >= transaccion.confirmacionesRequeridas) {
        if (transaccion.tipo === 'deposito' && transaccion.estado === 'pendiente') {
          updateData.estado = 'confirmado';
        } else if (transaccion.tipo === 'retiro' && transaccion.estado === 'procesando') {
          updateData.estado = 'confirmado';
        }
      } else if (confirmaciones > 0 && transaccion.estado === 'pendiente') {
        updateData.estado = 'procesando';
      }

      await TransaccionBlockchain.update(updateData, {
        where: { id },
        transaction
      });

      // Si es un depósito confirmado, acreditar balance
      if (transaccion.tipo === 'deposito' && updateData.estado === 'confirmado' && transaccion.estado !== 'confirmado') {
        await TransaccionBlockchain._acreditarDeposito(transaccion, transaction);
      }

      await transaction.commit();
      return await TransaccionBlockchain.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al actualizar confirmaciones: ${error.message}`);
    }
  };

  TransaccionBlockchain._acreditarDeposito = async (transaccion, transaction) => {
    try {
      console.log(`🔧 DEBUG - Acreditando depósito:`, {
        transaccionId: transaccion.id,
        userId: transaccion.userId,
        criptomonedaId: transaccion.criptomonedaId,
        cantidad: transaccion.cantidad,
        estado: transaccion.estado
      });

      // Actualizar balance del usuario usando la entidad directa
      const [balance] = await BalanceUsuario.findOrCreate({
        where: {
          userId: transaccion.userId,
          criptomonedaId: transaccion.criptomonedaId
        },
        defaults: {
          userId: transaccion.userId,
          criptomonedaId: transaccion.criptomonedaId,
          balanceDisponible: 0,
          balanceBloqueado: 0
        },
        transaction
      });

      console.log(`🔧 DEBUG - Balance actual antes de acreditar:`, {
        balanceId: balance.id,
        balanceDisponible: balance.balanceDisponible,
        balanceBloqueado: balance.balanceBloqueado
      });

      const nuevoBalance = parseFloat(balance.balanceDisponible) + parseFloat(transaccion.cantidad);
      
      console.log(`🔧 DEBUG - Nuevo balance calculado:`, {
        balanceAnterior: parseFloat(balance.balanceDisponible),
        cantidadDepositada: parseFloat(transaccion.cantidad),
        nuevoBalance: nuevoBalance
      });

      // ✅ CORRECCIÓN CRÍTICA: Actualizar el balance correctamente
      const [updatedRows] = await BalanceUsuario.update(
        { balanceDisponible: nuevoBalance },
        { 
          where: { id: balance.id },
          transaction,
          returning: true // Para PostgreSQL, obtener el registro actualizado
        }
      );

      console.log(`🔧 DEBUG - Balance actualizado, filas afectadas: ${updatedRows || 1}`);

      // ✅ CORRECCIÓN: Verificar que el balance se actualizó correctamente
      const balanceVerificacion = await BalanceUsuario.findByPk(balance.id, { transaction });
      console.log(`🔧 DEBUG - Balance después de actualizar:`, {
        balanceDisponible: balanceVerificacion.balanceDisponible,
        balanceBloqueado: balanceVerificacion.balanceBloqueado
      });

      // ✅ CORRECCIÓN: Marcar transacción como completada (no confirmada)
      await TransaccionBlockchain.update(
        { 
          estado: 'completado',
          fechaCompletado: new Date()
        },
        { 
          where: { id: transaccion.id },
          transaction
        }
      );

      console.log(`✅ Depósito acreditado exitosamente: ${transaccion.cantidad} para usuario ${transaccion.userId}`);
      
      // ✅ MEJORA: Obtener símbolo de criptomoneda para log
      try {
        const criptomoneda = await sequelize.models.Criptomoneda.findByPk(transaccion.criptomonedaId, { transaction });
        console.log(`✅ Depósito completado: ${transaccion.cantidad} ${criptomoneda?.symbol || 'BTC'} acreditado al usuario ${transaccion.userId}`);
      } catch (logError) {
        console.log(`✅ Depósito completado: ${transaccion.cantidad} acreditado al usuario ${transaccion.userId}`);
      }

    } catch (error) {
      console.error(`❌ Error crítico acreditando depósito:`, error);
      throw new Error(`Error al acreditar depósito: ${error.message}`);
    }
  };

  // =================== MÉTODOS PARA RETIROS ===================

  TransaccionBlockchain.createWithdrawal = async (data) => {
    const transaction = await sequelize.transaction();
    
    try {
      // Validar datos requeridos
      if (!data.userId || !data.criptomonedaId || !data.cantidad || !data.direccionDestino) {
        throw new Error('Datos incompletos para crear retiro');
      }

      // Verificar balance suficiente usando la entidad directa
      const balance = await BalanceUsuario.findOne({
        where: {
          userId: data.userId,
          criptomonedaId: data.criptomonedaId
        },
        transaction
      });

      if (!balance || parseFloat(balance.balanceDisponible) < parseFloat(data.cantidad)) {
        throw new Error('Balance insuficiente para retiro. (Mensaje desde el model)');
      }

      // Bloquear balance
      const nuevoBalanceDisponible = parseFloat(balance.balanceDisponible) - parseFloat(data.cantidad);
      const nuevoBalanceBloqueado = parseFloat(balance.balanceBloqueado) + parseFloat(data.cantidad);

      await BalanceUsuario.update(
        { 
          balanceDisponible: nuevoBalanceDisponible,
          balanceBloqueado: nuevoBalanceBloqueado
        },
        { 
          where: { id: balance.id },
          transaction
        }
      );

      // Crear transacción de retiro
      const retiroData = {
        ...data,
        tipo: 'retiro',
        estado: 'pendiente',
        confirmaciones: 0,
        requiereAprobacion: false, // Automático por ahora
        feeBlockchain: data.feeBlockchain || 0
      };

      const nuevoRetiro = await TransaccionBlockchain.create(retiroData, { transaction });
      await transaction.commit();

      return await TransaccionBlockchain.getById(nuevoRetiro.id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al crear retiro: ${error.message}`);
    }
  };

  TransaccionBlockchain.markWithdrawalAsSent = async (id, txHash, feeBlockchain) => {
    const transaction = await sequelize.transaction();
    
    try {
      const retiro = await TransaccionBlockchain.findByPk(id, { transaction });
      
      if (!retiro) {
        throw new Error('Retiro no encontrado');
      }

      if (retiro.tipo !== 'retiro') {
        throw new Error('La transacción no es un retiro');
      }

      if (retiro.estado !== 'pendiente') {
        throw new Error('El retiro no está en estado pendiente');
      }

      await TransaccionBlockchain.update(
        {
          estado: 'procesando',
          txHash: txHash,
          feeBlockchain: feeBlockchain,
          confirmaciones: 0
        },
        { 
          where: { id },
          transaction
        }
      );

      await transaction.commit();
      return await TransaccionBlockchain.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al marcar retiro como enviado: ${error.message}`);
    }
  };

  TransaccionBlockchain.completeWithdrawal = async (id) => {
    const transaction = await sequelize.transaction();
    
    try {
      const retiro = await TransaccionBlockchain.findByPk(id, { transaction });
      
      if (!retiro) {
        throw new Error('Retiro no encontrado');
      }

      // Desbloquear balance (liberar los fondos ya enviados) usando la entidad directa
      const balance = await BalanceUsuario.findOne({
        where: {
          userId: retiro.userId,
          criptomonedaId: retiro.criptomonedaId
        },
        transaction
      });

      if (balance) {
        const nuevoBalanceBloqueado = parseFloat(balance.balanceBloqueado) - parseFloat(retiro.cantidad);
        
        await BalanceUsuario.update(
          { balanceBloqueado: Math.max(0, nuevoBalanceBloqueado) },
          { 
            where: { id: balance.id },
            transaction
          }
        );
      }

      // Marcar como completado
      await TransaccionBlockchain.update(
        { estado: 'completado' },
        { 
          where: { id },
          transaction
        }
      );

      await transaction.commit();
      return await TransaccionBlockchain.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al completar retiro: ${error.message}`);
    }
  };

  TransaccionBlockchain.failWithdrawal = async (id, razon) => {
    const transaction = await sequelize.transaction();
    
    try {
      const retiro = await TransaccionBlockchain.findByPk(id, { transaction });
      
      if (!retiro) {
        throw new Error('Retiro no encontrado');
      }

      // Revertir balance (devolver fondos al disponible) usando la entidad directa
      const balance = await BalanceUsuario.findOne({
        where: {
          userId: retiro.userId,
          criptomonedaId: retiro.criptomonedaId
        },
        transaction
      });

      if (balance) {
        const nuevoBalanceDisponible = parseFloat(balance.balanceDisponible) + parseFloat(retiro.cantidad);
        const nuevoBalanceBloqueado = parseFloat(balance.balanceBloqueado) - parseFloat(retiro.cantidad);
        
        await BalanceUsuario.update(
          { 
            balanceDisponible: nuevoBalanceDisponible,
            balanceBloqueado: Math.max(0, nuevoBalanceBloqueado)
          },
          { 
            where: { id: balance.id },
            transaction
          }
        );
      }

      // Marcar como fallido
      await TransaccionBlockchain.update(
        { estado: 'fallido' },
        { 
          where: { id },
          transaction
        }
      );

      await transaction.commit();
      return await TransaccionBlockchain.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al fallar retiro: ${error.message}`);
    }
  };

  // =================== MÉTODOS DE CONSULTA ESPECÍFICOS ===================

  TransaccionBlockchain.getPendingDeposits = async () => {
    try {
      const deposits = await TransaccionBlockchain.findAll({
        where: {
          tipo: 'deposito',
          estado: ['pendiente', 'procesando']
        },
        include: [
          {
            model: sequelize.models.Usuario,
            as: 'usuario',
            attributes: ['id', 'email', 'username']
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'red']
          }
        ],
        order: [['created_at', 'ASC']]
      });
      return deposits;
    } catch (error) {
      throw new Error(`Error al obtener depósitos pendientes: ${error.message}`);
    }
  };

  TransaccionBlockchain.getPendingWithdrawals = async () => {
    try {
      const withdrawals = await TransaccionBlockchain.findAll({
        where: {
          tipo: 'retiro',
          estado: ['pendiente', 'procesando']
        },
        include: [
          {
            model: sequelize.models.Usuario,
            as: 'usuario',
            attributes: ['id', 'email', 'username']
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'red']
          }
        ],
        order: [['created_at', 'ASC']]
      });
      return withdrawals;
    } catch (error) {
      throw new Error(`Error al obtener retiros pendientes: ${error.message}`);
    }
  };

  TransaccionBlockchain.getTransactionsByHash = async (txHashes) => {
    try {
      const transactions = await TransaccionBlockchain.findAll({
        where: {
          txHash: { [Op.in]: txHashes }
        },
        include: [
          {
            model: sequelize.models.Usuario,
            as: 'usuario',
            attributes: ['id', 'email', 'username']
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'red']
          }
        ]
      });
      return transactions;
    } catch (error) {
      throw new Error(`Error al obtener transacciones por hash: ${error.message}`);
    }
  };

  // =================== MÉTODOS ESTADÍSTICOS ===================

  TransaccionBlockchain.getStats = async (filters = {}) => {
    try {
      const whereClause = {};
      
      if (filters.fechaDesde || filters.fechaHasta) {
        whereClause.created_at = {};
        if (filters.fechaDesde) {
          whereClause.created_at[Op.gte] = new Date(filters.fechaDesde);
        }
        if (filters.fechaHasta) {
          whereClause.created_at[Op.lte] = new Date(filters.fechaHasta);
        }
      }

      const statsGenerales = await TransaccionBlockchain.findAll({
        attributes: [
          'tipo',
          'estado',
          [sequelize.fn('COUNT', sequelize.col('id')), 'cantidad'],
          [sequelize.fn('SUM', sequelize.col('cantidad')), 'volumen']
        ],
        where: whereClause,
        group: ['tipo', 'estado'],
        raw: true
      });

      const statsPorCrypto = await TransaccionBlockchain.findAll({
        attributes: [
          'criptomonedaId',
          'tipo',
          [sequelize.fn('COUNT', sequelize.col('TransaccionBlockchain.id')), 'cantidad'],
          [sequelize.fn('SUM', sequelize.col('cantidad')), 'volumen']
        ],
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['symbol', 'nombre', 'red']
          }
        ],
        where: whereClause,
        group: ['criptomonedaId', 'tipo', 'criptomoneda.id'],
        raw: false
      });

      return {
        estadisticasGenerales: statsGenerales,
        estadisticasPorCriptomoneda: statsPorCrypto
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  };

  // =================== MÉTODOS DE VALIDACIÓN ===================

  TransaccionBlockchain.validateWithdrawal = async (userId, criptomonedaId, cantidad, direccionDestino) => {
    try {
      // Validar usuario activo
      const usuario = await sequelize.models.Usuario.findByPk(userId);
      if (!usuario || !usuario.activo) {
        return { valid: false, message: 'Usuario no encontrado o inactivo' };
      }

      // Validar criptomoneda activa
      const criptomoneda = await sequelize.models.Criptomoneda.findByPk(criptomonedaId);
      if (!criptomoneda || !criptomoneda.activa) {
        return { valid: false, message: 'Criptomoneda no encontrada o inactiva' };
      }

      // Validar balance suficiente usando la entidad directa
      const balance = await BalanceUsuario.findOne({
        where: { userId, criptomonedaId }
      });

      // ESTO DE ACÁ ABAJO ESTÁ BIEN, AUNQUE NO TESTEADO, PERO POR AHORA SON VALIDACIONES INNECESARIAS

      /*if (!balance || parseFloat(balance.balanceDisponible) < parseFloat(cantidad)) {
        return { valid: false, message: 'Balance insuficiente' }; //<----- Llega a acá bien
      }*/

      // Validar monto mínimo
      /*const montoMinimo = process.env[`MIN_WITHDRAWAL_${criptomoneda.symbol}`] || 0.001;
      if (parseFloat(cantidad) < parseFloat(montoMinimo)) {
        return { valid: false, message: `Monto mínimo de retiro: ${montoMinimo} ${criptomoneda.symbol}` };
      }*/

      // Validar límites diarios (pendiente transacciones) //Innecesario por ahora
      /*const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const manana = new Date(hoy);
      manana.setDate(hoy.getDate() + 1);

      const retirosDiarios = await TransaccionBlockchain.findAll({
        where: {
          userId,
          tipo: 'retiro',
          estado: ['pendiente', 'procesando', 'confirmado', 'completado'],
          created_at: { [Op.between]: [hoy, manana] }
        }
      });*/

      /*const maxRetirosPendientes = parseInt(process.env.MAX_PENDING_WITHDRAWALS_PER_USER) || 5;
      if (retirosDiarios.length >= maxRetirosPendientes) {
        return { valid: false, message: `Máximo ${maxRetirosPendientes} retiros por día` };
      }*/

      return {
        valid: true,
        message: 'Retiro válido',
        fee: 0, // Calcular fee real después
        usuario,
        criptomoneda,
        balance
      };
    } catch (error) {
      return { valid: false, message: `Error en validación: ${error.message}` };
    }
  };

  TransaccionBlockchain.cleanupBalanceCheckTransactions = async () => {
    try {
      console.log('🧹 Limpiando transacciones de balance check stuck...');
      
      // Encontrar todas las transacciones de balance check pendientes
      const stuckTxs = await TransaccionBlockchain.findAll({
        where: {
          estado: ['pendiente', 'procesando'],
          txHash: {
            [Op.or]: [
              { [Op.like]: 'bsc_balance_%' },
              { [Op.like]: 'eth_balance_%' },
              { [Op.like]: 'balance_%' }
            ]
          }
        }
      });
      
      console.log(`🧹 Encontradas ${stuckTxs.length} transacciones de balance check stuck`);
      
      let cleaned = 0;
      for (const tx of stuckTxs) {
        try {
          await TransaccionBlockchain.updateConfirmations(
            tx.id,
            tx.confirmacionesRequeridas || 6, // Confirmar completamente
            tx.txHash
          );
          cleaned++;
          console.log(`✅ Auto-confirmada: ${tx.txHash}`);
        } catch (error) {
          console.error(`Error limpiando ${tx.txHash}: ${error.message}`);
        }
      }
      
      console.log(`🧹 Limpieza completada: ${cleaned}/${stuckTxs.length} transacciones procesadas`);
      return { total: stuckTxs.length, cleaned };
      
    } catch (error) {
      console.error('Error en limpieza de balance checks:', error.message);
      throw error;
    }
  };

  return TransaccionBlockchain;
}

module.exports = createTransaccionBlockchainModel;