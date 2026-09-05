// models/transaccionBlockchain.model.js
require('dotenv').config();
const initTransaccionBlockchain = require('./entities/transaccionBlockchain.entity');
const { Op } = require('sequelize');
const money = require('../utils/money');

function createTransaccionBlockchainModel(sequelize) {
  const TransaccionBlockchain = initTransaccionBlockchain(sequelize);

  // =================== MÉTODOS DE CONSULTA BÁSICOS ===================
  
  TransaccionBlockchain.getById = async (id, transaction = null) => {
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
        ],
        transaction
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

      // Paso D: depósito detectado → acreditar en estado PENDIENTE en el ledger
      // (external_onchain → funding:pendiente). Al confirmar, _acreditarDeposito
      // lo mueve a disponible.
      const { registrarDepositoPendiente } = require('../services/ledger/operations');
      await registrarDepositoPendiente({
        userId: data.userId,
        criptomonedaId: data.criptomonedaId,
        cantidad: String(data.cantidad),
        referencia: `deposito-pend:${nuevoDeposito.id}`,
      }, transaction);

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

      // Paso D: si es un retiro confirmado on-chain, debitar los fondos bloqueados
      // al mundo on-chain (funding:bloqueado → external_onchain). Se hace acá
      // (confirmación), no en el broadcast: el reaper puede revertir un
      // 'procesando' sin confirmar vía failWithdrawal (bloqueado→disponible), y si
      // ya hubiéramos debitado a external eso quedaría inconsistente.
      if (transaccion.tipo === 'retiro' && updateData.estado === 'confirmado' && transaccion.estado !== 'confirmado') {
        const { marcarRetiroTransmitido } = require('../services/ledger/operations');
        await marcarRetiroTransmitido({
          userId: transaccion.userId,
          criptomonedaId: transaccion.criptomonedaId,
          cantidad: String(transaccion.cantidad),
          referencia: `retiro:${transaccion.id}`,
        }, transaction);
      }

      await transaction.commit();
      return await TransaccionBlockchain.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al actualizar confirmaciones: ${error.message}`);
    }
  };

  TransaccionBlockchain._acreditarDeposito = async (transaccion, transaction) => {
    // Fix 2026-08-19 (AUDITORIA_BACKEND.md Altos #10): antes este archivo
    // re-inicializaba la entidad BalanceUsuario cruda a nivel de módulo
    // (initBalanceUsuario(sequelize)) en vez de importar el modelo que
    // models/index.js ya inicializó y ya asoció — funcionaba porque es la
    // misma clase JS (require cachea el módulo), pero era frágil ante
    // cualquier cambio de orden de carga. Este require es lazy (adentro de
    // la función, no a nivel de módulo) a propósito: a nivel de módulo
    // sería circular (transaccionBlockchain.model.js se está cargando
    // *desde* models/index.js), pero para cuando esta función corre de
    // verdad (un request real) models/index.js ya terminó de inicializar.
    try {
      console.log(`🔧 DEBUG - Acreditando depósito:`, {
        transaccionId: transaccion.id,
        userId: transaccion.userId,
        criptomonedaId: transaccion.criptomonedaId,
        cantidad: transaccion.cantidad,
        estado: transaccion.estado
      });

      // Paso D: el depósito ya está en funding:pendiente (registrado al detectarse
      // en createDeposit). Al confirmar, se mueve pendiente → disponible.
      const { confirmarDeposito } = require('../services/ledger/operations');
      await confirmarDeposito({
        userId: transaccion.userId,
        criptomonedaId: transaccion.criptomonedaId,
        cantidad: String(transaccion.cantidad),
        referencia: `deposito-conf:${transaccion.id}`,
      }, transaction);

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

  // `finalize` (opcional): hook que corre DENTRO de la transacción del retiro,
  // después de crear la fila y antes del commit, recibiendo (transaction, retiro).
  // Lo usa el controller para completar la key de idempotencia en la misma tx
  // (hardening anti-doble-gasto): el bloqueo de fondos + el alta del retiro + el
  // 'completed' de la key commitean atómicamente. Sin el hook (otros callers) el
  // comportamiento es el de antes.
  TransaccionBlockchain.createWithdrawal = async (data, { finalize } = {}) => {
    // Ver el comentario de _acreditarDeposito sobre por qué este require
    // es lazy (Altos #10).
    const { BalanceUsuario } = require('./index');
    const transaction = await sequelize.transaction();

    try {
      // Validar datos requeridos
      if (!data.userId || !data.criptomonedaId || !data.cantidad || !data.direccionDestino) {
        throw new Error('Datos incompletos para crear retiro');
      }

      // Write-flip (Paso B): bloquear via el metodo (postea disponible->bloqueado
      // en el ledger; el guard de sobregiro del ledger rechaza si no alcanza). Su
      // mensaje /insuficiente/ preserva la semantica de "Balance insuficiente para
      // retiro" para el caller.
      await BalanceUsuario.blockBalance(data.userId, data.criptomonedaId, String(data.cantidad), transaction);

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
      // Lectura enriquecida DENTRO de la tx: así el body que el caller almacena en
      // la key (para replay) es idéntico al que devuelve/serializa la respuesta.
      const retiro = await TransaccionBlockchain.getById(nuevoRetiro.id, transaction);

      if (finalize) await finalize(transaction, retiro);

      await transaction.commit();
      return retiro;
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al crear retiro: ${error.message}`);
    }
  };

  // Claim atómico de un retiro pendiente ANTES de transmitir on-chain
  // (anti doble-gasto). El broadcast ocurría con la fila todavía en 'pendiente',
  // así que dos corridas concurrentes (job + endpoint manual, o multi-instancia)
  // seleccionaban la misma fila y transmitían el retiro dos veces = doble salida
  // de la wallet maestra (ROADMAP Fase 1 #0). Este UPDATE condicional es atómico
  // a nivel fila en Postgres: de dos corridas concurrentes, solo una matchea
  // `estado='pendiente'` y obtiene affected=1; la otra queda en 0 y se saltea.
  // Devuelve true si ESTA corrida reclamó la fila.
  // Trade-off documentado: si el proceso cae entre el claim y el envío, la fila
  // queda en 'procesando' sin txHash (fondos bloqueados) — más seguro que un
  // doble envío, pero necesita un reaper de claims viejos (follow-up).
  TransaccionBlockchain.claimForProcessing = async (id) => {
    const [affected] = await TransaccionBlockchain.update(
      { estado: 'procesando' },
      { where: { id, tipo: 'retiro', estado: 'pendiente' } }
    );
    return affected === 1;
  };

  // Persiste el txHash (intención de envío) ANTES del broadcast, mientras la
  // fila está en 'procesando' (ya reclamada). Así, si el proceso cae alrededor
  // del broadcast, el reaper tiene un hash concreto para verificar on-chain si
  // el retiro salió o no — en vez de tener que adivinar. No cambia el estado.
  TransaccionBlockchain.recordWithdrawalTxHash = async (id, txHash) => {
    await TransaccionBlockchain.update(
      { txHash },
      { where: { id, tipo: 'retiro', estado: 'procesando' } }
    );
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

      // Acepta 'pendiente' (paths aún no migrados que envían y luego marcan) y
      // 'procesando' (path con claim atómico: la fila ya fue reclamada antes del
      // envío). Cualquier otro estado (confirmado/completado/fallido) es inválido.
      if (retiro.estado !== 'pendiente' && retiro.estado !== 'procesando') {
        throw new Error('El retiro no está en estado pendiente ni procesando');
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

  // (Paso D: completeWithdrawal se eliminó — era código muerto sin callers. El
  // débito de los fondos bloqueados al mundo on-chain ahora lo hace
  // updateConfirmations al confirmarse el retiro, vía marcarRetiroTransmitido
  // (funding:bloqueado → external_onchain), simétrico a _acreditarDeposito.)

  TransaccionBlockchain.failWithdrawal = async (id, razon) => {
    // Ver el comentario de _acreditarDeposito (Altos #10).
    const { BalanceUsuario } = require('./index');
    const transaction = await sequelize.transaction();

    try {
      const retiro = await TransaccionBlockchain.findByPk(id, { transaction });

      if (!retiro) {
        throw new Error('Retiro no encontrado');
      }

      // Guard de estado (simétrico a markWithdrawalAsSent): solo se puede fallar
      // un retiro que sigue 'pendiente' o 'procesando'. Fallar uno ya
      // 'confirmado'/'completado' es peligroso: marcarRetiroTransmitido ya movió
      // los fondos a external_onchain (salieron on-chain), y unblockBalance los
      // devolvería a disponible consumiendo el bloqueado de OTRA reserva del
      // mismo usuario → creación de dinero. Fallar uno ya 'fallido' duplicaría el
      // desbloqueo. El reaper solo pasa filas 'procesando', así que no lo afecta.
      if (retiro.estado !== 'pendiente' && retiro.estado !== 'procesando') {
        throw new Error(`No se puede fallar un retiro en estado ${retiro.estado}`);
      }

      // Write-flip (Paso B): retiro fallido → devolver bloqueado a disponible.
      await BalanceUsuario.unblockBalance(retiro.userId, retiro.criptomonedaId, String(retiro.cantidad), transaction);

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
    // Ver el comentario de _acreditarDeposito (Altos #10).
    const { BalanceUsuario } = require('./index');
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

      // (Write-flip Paso B: se removio el findOne de balances_users que aca solo
      // alimentaba validaciones comentadas — lectura muerta del path legacy.)

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

  // Fix 2026-08-19 (AUDITORIA_BACKEND.md Altos #7): existía acá una
  // cleanupBalanceCheckTransactions() que buscaba el mismo patrón de
  // txHash ('*_balance_%') que scripts/cleanup-stuck-transactions.js, pero
  // en vez de limpiarlas las forzaba a "confirmadas" vía
  // updateConfirmations() — lo que dispara _acreditarDeposito() y acredita
  // saldo REAL por transacciones que son solo placeholders de chequeo de
  // balance. Dos implementaciones del mismo nombre haciendo lo opuesto:
  // una borra, la otra acredita saldo falso. Nunca se llamaba desde
  // ningún lado (confirmado por grep), así que no rompía nada hoy — pero
  // era una trampa para quien decidiera "arreglar" el require roto del
  // job de blockchain (Altos #6) usando este método del modelo en vez del
  // script real. Eliminada; scripts/cleanup-stuck-transactions.js es la
  // única implementación que queda, y es la correcta.

  return TransaccionBlockchain;
}

module.exports = createTransaccionBlockchainModel;