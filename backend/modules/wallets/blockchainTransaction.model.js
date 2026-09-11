// models/transaccionBlockchain.model.js
require('dotenv').config();
const initTransaccionBlockchain = require('./blockchainTransaction.entity');
const { Op } = require('sequelize');
const money = require('../../utils/money');

function createTransaccionBlockchainModel(sequelize) {
  const BlockchainTransaction = initTransaccionBlockchain(sequelize);

  // =================== MÉTODOS DE CONSULTA BÁSICOS ===================
  
  BlockchainTransaction.getById = async (id, transaction = null) => {
    try {
      const transaccion = await BlockchainTransaction.findByPk(id, {
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'username', 'active']
          },
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['id', 'symbol', 'name', 'network', 'decimals']
          },
          {
            model: sequelize.models.User,
            as: 'adminApprover',
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

  BlockchainTransaction.getByTxHash = async (txHash) => {
    try {
      const transaccion = await BlockchainTransaction.findOne({
        where: { txHash },
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'username']
          },
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['id', 'symbol', 'name', 'network']
          }
        ]
      });
      return transaccion;
    } catch (error) {
      throw new Error(`Error al obtener transacción por hash: ${error.message}`);
    }
  };

  BlockchainTransaction.getByUser = async (userId, filters = {}) => {
    try {
      const whereClause = { userId };
      
      if (filters.type) whereClause.type = filters.type;
      if (filters.status) whereClause.status = filters.status;
      if (filters.cryptoId) whereClause.cryptoId = filters.cryptoId;
      
      if (filters.fechaDesde || filters.fechaHasta) {
        whereClause.created_at = {};
        if (filters.fechaDesde) {
          whereClause.created_at[Op.gte] = new Date(filters.fechaDesde);
        }
        if (filters.fechaHasta) {
          whereClause.created_at[Op.lte] = new Date(filters.fechaHasta);
        }
      }

      const { count, rows } = await BlockchainTransaction.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['id', 'symbol', 'name', 'network', 'decimals']
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

  BlockchainTransaction.getAllWithFilters = async (filters = {}) => {
    try {
      const whereClause = {};
      
      if (filters.type) whereClause.type = filters.type;
      if (filters.status) whereClause.status = filters.status;
      if (filters.userId) whereClause.userId = filters.userId;
      if (filters.cryptoId) whereClause.cryptoId = filters.cryptoId;
      if (filters.requiresApproval !== undefined) {
        whereClause.requiresApproval = filters.requiresApproval === 'true';
      }
      
      if (filters.montoMin || filters.montoMax) {
        whereClause.amount = {};
        if (filters.montoMin) whereClause.amount[Op.gte] = parseFloat(filters.montoMin);
        if (filters.montoMax) whereClause.amount[Op.lte] = parseFloat(filters.montoMax);
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

      const { count, rows } = await BlockchainTransaction.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'username']
          },
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['id', 'symbol', 'name', 'network', 'decimals']
          },
          {
            model: sequelize.models.User,
            as: 'adminApprover',
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

  BlockchainTransaction.createDeposit = async (data) => {
    const transaction = await sequelize.transaction();
    
    try {
      // Validar datos requeridos
      if (!data.userId || !data.cryptoId || !data.amount || !data.txHash) {
        throw new Error('Datos incompletos para crear depósito');
      }

      // Verificar que no existe ya una transacción con este hash
      const existingTx = await BlockchainTransaction.findOne({
        where: { txHash: data.txHash },
        transaction
      });

      if (existingTx) {
        throw new Error('Ya existe una transacción con este hash');
      }

      // Crear la transacción de depósito
      const depositData = {
        ...data,
        type: 'deposit',
        status: 'pending',
        confirmations: 0,
        requiresApproval: false
      };

      const nuevoDeposito = await BlockchainTransaction.create(depositData, { transaction });

      // Paso D: depósito detectado → acreditar en estado PENDIENTE en el ledger
      // (external_onchain → funding:pendiente). Al confirmar, _creditDeposit
      // lo mueve a disponible.
      const { registerPendingDeposit } = require('../balances/ledger/operations');
      await registerPendingDeposit({
        userId: data.userId,
        criptomonedaId: data.cryptoId,
        cantidad: String(data.amount),
        referencia: `deposito-pend:${nuevoDeposito.id}`,
      }, transaction);

      await transaction.commit();

      return await BlockchainTransaction.getById(nuevoDeposito.id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al crear depósito: ${error.message}`);
    }
  };

  BlockchainTransaction.updateConfirmations = async (id, confirmaciones, newTxHash = null) => {
    const transaction = await sequelize.transaction();
    
    try {
      const transaccion = await BlockchainTransaction.findByPk(id, {
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'crypto'
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
      if (confirmaciones >= transaccion.requiredConfirmations) {
        if (transaccion.type === 'deposit' && transaccion.status === 'pending') {
          updateData.status = 'confirmed';
        } else if (transaccion.type === 'withdrawal' && transaccion.status === 'processing') {
          updateData.status = 'confirmed';
        }
      } else if (confirmaciones > 0 && transaccion.status === 'pending') {
        updateData.status = 'processing';
      }

      await BlockchainTransaction.update(updateData, {
        where: { id },
        transaction
      });

      // Si es un depósito confirmado, acreditar balance
      if (transaccion.type === 'deposit' && updateData.status === 'confirmed' && transaccion.status !== 'confirmed') {
        await BlockchainTransaction._creditDeposit(transaccion, transaction);
      }

      // Paso D: si es un retiro confirmado on-chain, debitar los fondos bloqueados
      // al mundo on-chain (funding:bloqueado → external_onchain). Se hace acá
      // (confirmación), no en el broadcast: el reaper puede revertir un
      // 'processing' sin confirmar vía failWithdrawal (bloqueado→disponible), y si
      // ya hubiéramos debitado a external eso quedaría inconsistente.
      if (transaccion.type === 'withdrawal' && updateData.status === 'confirmed' && transaccion.status !== 'confirmed') {
        const { markWithdrawalTransmitted } = require('../balances/ledger/operations');
        await markWithdrawalTransmitted({
          userId: transaccion.userId,
          criptomonedaId: transaccion.cryptoId,
          cantidad: String(transaccion.amount),
          referencia: `retiro:${transaccion.id}`,
        }, transaction);
      }

      await transaction.commit();
      return await BlockchainTransaction.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al actualizar confirmations: ${error.message}`);
    }
  };

  BlockchainTransaction._creditDeposit = async (transaccion, transaction) => {
    // Fix 2026-08-19 (AUDITORIA_BACKEND.md Altos #10): antes este archivo
    // re-inicializaba la entidad UserBalance cruda a nivel de módulo
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
        criptomonedaId: transaccion.cryptoId,
        amount: transaccion.amount,
        status: transaccion.status
      });

      // Paso D: el depósito ya está en funding:pendiente (registrado al detectarse
      // en createDeposit). Al confirmar, se mueve pendiente → disponible.
      const { confirmDeposit } = require('../balances/ledger/operations');
      await confirmDeposit({
        userId: transaccion.userId,
        criptomonedaId: transaccion.cryptoId,
        cantidad: String(transaccion.amount),
        referencia: `deposito-conf:${transaccion.id}`,
      }, transaction);

      // ✅ CORRECCIÓN: Marcar transacción como completada (no confirmada)
      await BlockchainTransaction.update(
        { 
          status: 'completed',
          fechaCompletado: new Date()
        },
        { 
          where: { id: transaccion.id },
          transaction
        }
      );

      console.log(`✅ Depósito acreditado exitosamente: ${transaccion.amount} para usuario ${transaccion.userId}`);
      
      // ✅ MEJORA: Obtener símbolo de crypto para log
      try {
        const crypto = await sequelize.models.Crypto.findByPk(transaccion.cryptoId, { transaction });
        console.log(`✅ Depósito completado: ${transaccion.amount} ${crypto?.symbol || 'BTC'} acreditado al usuario ${transaccion.userId}`);
      } catch (logError) {
        console.log(`✅ Depósito completado: ${transaccion.amount} acreditado al usuario ${transaccion.userId}`);
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
  BlockchainTransaction.createWithdrawal = async (data, { finalize } = {}) => {
    // Ver el comentario de _creditDeposit sobre por qué este require
    // es lazy (Altos #10).
    const { UserBalance } = require('../../models/index');
    const transaction = await sequelize.transaction();

    try {
      // Validar datos requeridos
      if (!data.userId || !data.cryptoId || !data.amount || !data.destinationAddress) {
        throw new Error('Datos incompletos para crear retiro');
      }

      // Write-flip (Paso B): bloquear via el metodo (postea disponible->bloqueado
      // en el ledger; el guard de sobregiro del ledger rechaza si no alcanza). Su
      // mensaje /insuficiente/ preserva la semantica de "Balance insuficiente para
      // retiro" para el caller.
      await UserBalance.blockBalance(data.userId, data.cryptoId, String(data.amount), transaction);

      // Crear transacción de retiro
      const retiroData = {
        ...data,
        type: 'withdrawal',
        status: 'pending',
        confirmations: 0,
        requiresApproval: false, // Automático por ahora
        blockchainFee: data.blockchainFee || 0
      };

      const nuevoRetiro = await BlockchainTransaction.create(retiroData, { transaction });
      // Lectura enriquecida DENTRO de la tx: así el body que el caller almacena en
      // la key (para replay) es idéntico al que devuelve/serializa la respuesta.
      const retiro = await BlockchainTransaction.getById(nuevoRetiro.id, transaction);

      if (finalize) await finalize(transaction, retiro);

      await transaction.commit();
      return retiro;
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al crear retiro: ${error.message}`);
    }
  };

  // Claim atómico de un retiro pendiente ANTES de transmitir on-chain
  // (anti doble-gasto). El broadcast ocurría con la fila todavía en 'pending',
  // así que dos corridas concurrentes (job + endpoint manual, o multi-instancia)
  // seleccionaban la misma fila y transmitían el retiro dos veces = doble salida
  // de la wallet maestra (ROADMAP Fase 1 #0). Este UPDATE condicional es atómico
  // a nivel fila en Postgres: de dos corridas concurrentes, solo una matchea
  // `estado='pending'` y obtiene affected=1; la otra queda en 0 y se saltea.
  // Devuelve true si ESTA corrida reclamó la fila.
  // Trade-off documentado: si el proceso cae entre el claim y el envío, la fila
  // queda en 'processing' sin txHash (fondos bloqueados) — más seguro que un
  // doble envío, pero necesita un reaper de claims viejos (follow-up).
  BlockchainTransaction.claimForProcessing = async (id) => {
    const [affected] = await BlockchainTransaction.update(
      { status: 'processing' },
      { where: { id, type: 'withdrawal', status: 'pending' } }
    );
    return affected === 1;
  };

  // Persiste el txHash (intención de envío) ANTES del broadcast, mientras la
  // fila está en 'processing' (ya reclamada). Así, si el proceso cae alrededor
  // del broadcast, el reaper tiene un hash concreto para verificar on-chain si
  // el retiro salió o no — en vez de tener que adivinar. No cambia el estado.
  BlockchainTransaction.recordWithdrawalTxHash = async (id, txHash) => {
    await BlockchainTransaction.update(
      { txHash },
      { where: { id, type: 'withdrawal', status: 'processing' } }
    );
  };

  BlockchainTransaction.markWithdrawalAsSent = async (id, txHash, blockchainFee) => {
    const transaction = await sequelize.transaction();

    try {
      const retiro = await BlockchainTransaction.findByPk(id, { transaction });

      if (!retiro) {
        throw new Error('Retiro no encontrado');
      }

      if (retiro.type !== 'withdrawal') {
        throw new Error('La transacción no es un retiro');
      }

      // Acepta 'pending' (paths aún no migrados que envían y luego marcan) y
      // 'processing' (path con claim atómico: la fila ya fue reclamada antes del
      // envío). Cualquier otro estado (confirmado/completado/fallido) es inválido.
      if (retiro.status !== 'pending' && retiro.status !== 'processing') {
        throw new Error('El retiro no está en estado pendiente ni procesando');
      }

      await BlockchainTransaction.update(
        {
          status: 'processing',
          txHash: txHash,
          blockchainFee: blockchainFee,
          confirmations: 0
        },
        { 
          where: { id },
          transaction
        }
      );

      await transaction.commit();
      return await BlockchainTransaction.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al marcar retiro como enviado: ${error.message}`);
    }
  };

  // (Paso D: completeWithdrawal se eliminó — era código muerto sin callers. El
  // débito de los fondos bloqueados al mundo on-chain ahora lo hace
  // updateConfirmations al confirmarse el retiro, vía markWithdrawalTransmitted
  // (funding:bloqueado → external_onchain), simétrico a _creditDeposit.)

  BlockchainTransaction.failWithdrawal = async (id, razon) => {
    // Ver el comentario de _creditDeposit (Altos #10).
    const { UserBalance } = require('../../models/index');
    const transaction = await sequelize.transaction();

    try {
      const retiro = await BlockchainTransaction.findByPk(id, { transaction });

      if (!retiro) {
        throw new Error('Retiro no encontrado');
      }

      // Guard de estado (simétrico a markWithdrawalAsSent): solo se puede fallar
      // un retiro que sigue 'pending' o 'processing'. Fallar uno ya
      // 'confirmed'/'completed' es peligroso: markWithdrawalTransmitted ya movió
      // los fondos a external_onchain (salieron on-chain), y unblockBalance los
      // devolvería a disponible consumiendo el bloqueado de OTRA reserva del
      // mismo usuario → creación de dinero. Fallar uno ya 'failed' duplicaría el
      // desbloqueo. El reaper solo pasa filas 'processing', así que no lo afecta.
      if (retiro.status !== 'pending' && retiro.status !== 'processing') {
        throw new Error(`No se puede fallar un retiro en estado ${retiro.status}`);
      }

      // Write-flip (Paso B): retiro fallido → devolver bloqueado a disponible.
      await UserBalance.unblockBalance(retiro.userId, retiro.cryptoId, String(retiro.amount), transaction);

      // Marcar como fallido
      await BlockchainTransaction.update(
        { status: 'failed' },
        { 
          where: { id },
          transaction
        }
      );

      await transaction.commit();
      return await BlockchainTransaction.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al fallar retiro: ${error.message}`);
    }
  };

  // =================== MÉTODOS DE CONSULTA ESPECÍFICOS ===================

  BlockchainTransaction.getPendingDeposits = async () => {
    try {
      const deposits = await BlockchainTransaction.findAll({
        where: {
          type: 'deposit',
          status: ['pending', 'processing']
        },
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'username']
          },
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['id', 'symbol', 'name', 'network']
          }
        ],
        order: [['created_at', 'ASC']]
      });
      return deposits;
    } catch (error) {
      throw new Error(`Error al obtener depósitos pendientes: ${error.message}`);
    }
  };

  BlockchainTransaction.getPendingWithdrawals = async () => {
    try {
      const withdrawals = await BlockchainTransaction.findAll({
        where: {
          type: 'withdrawal',
          status: ['pending', 'processing']
        },
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'username']
          },
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['id', 'symbol', 'name', 'network']
          }
        ],
        order: [['created_at', 'ASC']]
      });
      return withdrawals;
    } catch (error) {
      throw new Error(`Error al obtener retiros pendientes: ${error.message}`);
    }
  };

  BlockchainTransaction.getTransactionsByHash = async (txHashes) => {
    try {
      const transactions = await BlockchainTransaction.findAll({
        where: {
          txHash: { [Op.in]: txHashes }
        },
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'username']
          },
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['id', 'symbol', 'name', 'network']
          }
        ]
      });
      return transactions;
    } catch (error) {
      throw new Error(`Error al obtener transacciones por hash: ${error.message}`);
    }
  };

  // =================== MÉTODOS ESTADÍSTICOS ===================

  BlockchainTransaction.getStats = async (filters = {}) => {
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

      const statsGenerales = await BlockchainTransaction.findAll({
        attributes: [
          'tipo',
          'estado',
          [sequelize.fn('COUNT', sequelize.col('id')), 'amount'],
          [sequelize.fn('SUM', sequelize.col('amount')), 'volumen']
        ],
        where: whereClause,
        group: ['tipo', 'estado'],
        raw: true
      });

      const statsPorCrypto = await BlockchainTransaction.findAll({
        attributes: [
          'cryptoId',
          'tipo',
          [sequelize.fn('COUNT', sequelize.col('BlockchainTransaction.id')), 'amount'],
          [sequelize.fn('SUM', sequelize.col('amount')), 'volumen']
        ],
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['symbol', 'name', 'network']
          }
        ],
        where: whereClause,
        group: ['cryptoId', 'tipo', 'criptomoneda.id'],
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

  BlockchainTransaction.validateWithdrawal = async (userId, cryptoId, amount, destinationAddress) => {
    // Ver el comentario de _creditDeposit (Altos #10).
    const { UserBalance } = require('../../models/index');
    try {
      // Validar usuario active
      const usuario = await sequelize.models.User.findByPk(userId);
      if (!usuario || !usuario.active) {
        return { valid: false, message: 'Usuario no encontrado o inactivo' };
      }

      // Validar crypto active
      const crypto = await sequelize.models.Crypto.findByPk(cryptoId);
      if (!crypto || !crypto.active) {
        return { valid: false, message: 'Criptomoneda no encontrada o inactiva' };
      }

      // (Write-flip Paso B: se removio el findOne de balances_users que aca solo
      // alimentaba validaciones comentadas — lectura muerta del path legacy.)

      // ESTO DE ACÁ ABAJO ESTÁ BIEN, AUNQUE NO TESTEADO, PERO POR AHORA SON VALIDACIONES INNECESARIAS

      /*if (!balance || parseFloat(balance.availableBalance) < parseFloat(amount)) {
        return { valid: false, message: 'Balance insuficiente' }; //<----- Llega a acá bien
      }*/

      // Validar monto mínimo
      /*const montoMinimo = process.env[`MIN_WITHDRAWAL_${crypto.symbol}`] || 0.001;
      if (parseFloat(amount) < parseFloat(montoMinimo)) {
        return { valid: false, message: `Monto mínimo de retiro: ${montoMinimo} ${crypto.symbol}` };
      }*/

      // Validar límites diarios (pendiente transacciones) //Innecesario por ahora
      /*const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const manana = new Date(hoy);
      manana.setDate(hoy.getDate() + 1);

      const retirosDiarios = await BlockchainTransaction.findAll({
        where: {
          userId,
          type: 'withdrawal',
          status: ['pending', 'processing', 'confirmed', 'completed'],
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
        crypto,
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
  // updateConfirmations() — lo que dispara _creditDeposit() y acredita
  // saldo REAL por transacciones que son solo placeholders de chequeo de
  // balance. Dos implementaciones del mismo name haciendo lo opuesto:
  // una borra, la otra acredita saldo falso. Nunca se llamaba desde
  // ningún lado (confirmado por grep), así que no rompía nada hoy — pero
  // era una trampa para quien decidiera "arreglar" el require roto del
  // job de blockchain (Altos #6) usando este método del modelo en vez del
  // script real. Eliminada; scripts/cleanup-stuck-transactions.js es la
  // única implementación que queda, y es la correcta.

  return BlockchainTransaction;
}

module.exports = createTransaccionBlockchainModel;