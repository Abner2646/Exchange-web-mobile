// Importaciones
const initTransaccionBlockchain = require('./entities/transaccionBlockchain.entity');
const { Op } = require('sequelize');

function createTransaccionBlockchainModel(sequelize) {
  const TransaccionBlockchain = initTransaccionBlockchain(sequelize);

  // Métodos de consulta básicos
  TransaccionBlockchain.getById = async (id) => {
    try {
      const transaccion = await TransaccionBlockchain.findByPk(id, {
        include: [
          {
            model: sequelize.models.Usuario,
            as: 'usuario',
            attributes: ['id', 'username', 'email']
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'red', 'decimales']
          }
        ]
      });
      return transaccion;
    } catch (error) {
      throw new Error(`Error al obtener transacción blockchain por ID: ${error.message}`);
    }
  };

  TransaccionBlockchain.getAll = async (filters = {}) => {
    try {
      const whereClause = {};
      
      // Filtros disponibles
      if (filters.usuarioId) whereClause.usuarioId = filters.usuarioId;
      if (filters.criptomonedaId) whereClause.criptomonedaId = filters.criptomonedaId;
      if (filters.tipo) whereClause.tipo = filters.tipo;
      if (filters.estado) whereClause.estado = filters.estado;

      // Filtros de fecha
      if (filters.fechaDesde || filters.fechaHasta) {
        whereClause.created_at = {};
        if (filters.fechaDesde) whereClause.created_at[Op.gte] = new Date(filters.fechaDesde);
        if (filters.fechaHasta) whereClause.created_at[Op.lte] = new Date(filters.fechaHasta);
      }

      // Filtros de cantidad
      if (filters.cantidadMin) {
        whereClause.cantidad = { [Op.gte]: parseFloat(filters.cantidadMin) };
      }
      if (filters.cantidadMax) {
        whereClause.cantidad = {
          ...whereClause.cantidad,
          [Op.lte]: parseFloat(filters.cantidadMax)
        };
      }

      const { page = 1, limit = 20, orderBy = 'created_at', orderDirection = 'DESC' } = filters;
      const offset = (page - 1) * limit;

      const { count, rows } = await TransaccionBlockchain.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: sequelize.models.Usuario,
            as: 'usuario',
            attributes: ['id', 'username', 'email']
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'red']
          }
        ],
        order: [[orderBy, orderDirection]],
        limit: parseInt(limit),
        offset,
        distinct: true
      });

      return {
        transacciones: rows,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      };
    } catch (error) {
      throw new Error(`Error al obtener transacciones blockchain: ${error.message}`);
    }
  };

  // ================================
  // MÉTODOS AUTOMÁTICOS DE DEPÓSITOS
  // ================================

  // Escanear blockchain para nuevos depósitos
  TransaccionBlockchain.scanForDeposits = async () => {
    try {
      console.log('🔍 Escaneando blockchain para nuevos depósitos...');
      
      // Obtener todas las direcciones de depósito activas
      const { DireccionDeposito } = require('./index');
      const direccionesActivas = await DireccionDeposito.findAll({
        where: { activa: true },
        include: [
          {
            model: sequelize.models.Usuario,
            as: 'usuario',
            attributes: ['id', 'username']
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'red']
          }
        ]
      });

      const nuevosDepositos = [];

      // Por cada dirección, simular escaneo de blockchain
      for (const direccion of direccionesActivas) {
        // AQUÍ IRÍA LA INTEGRACIÓN REAL CON BLOCKCHAIN
        // Por ahora simulo con lógica de ejemplo
        const nuevasTransacciones = await simularEscaneoBlockchain(direccion);
        
        for (const txData of nuevasTransacciones) {
          // Verificar que no existe ya
          const existingTx = await TransaccionBlockchain.findOne({
            where: { txHash: txData.txHash }
          });
          
          if (!existingTx) {
            const nuevoDeposito = await TransaccionBlockchain.createDeposit({
              usuarioId: direccion.usuarioId,
              criptomonedaId: direccion.criptomonedaId,
              cantidad: txData.cantidad,
              txHash: txData.txHash,
              direccionOrigen: txData.direccionOrigen,
              direccionDestino: direccion.direccion,
              confirmaciones: txData.confirmaciones || 0,
              confirmacionesRequeridas: getRequiredConfirmations(direccion.criptomoneda.red)
            });
            
            nuevosDepositos.push(nuevoDeposito);
          }
        }
      }

      console.log(`✅ Encontrados ${nuevosDepositos.length} nuevos depósitos`);
      return nuevosDepositos;
    } catch (error) {
      console.error('❌ Error escaneando depósitos:', error);
      throw new Error(`Error al escanear depósitos: ${error.message}`);
    }
  };

  // Actualizar confirmaciones de todas las transacciones pendientes
  TransaccionBlockchain.updateAllConfirmations = async () => {
    try {
      console.log('🔄 Actualizando confirmaciones de transacciones pendientes...');
      
      const transaccionesPendientes = await TransaccionBlockchain.findAll({
        where: {
          estado: { [Op.in]: ['pendiente', 'procesando'] },
          txHash: { [Op.ne]: null }
        },
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['red']
          }
        ]
      });

      const actualizadas = [];

      for (const tx of transaccionesPendientes) {
        // AQUÍ IRÍA LA CONSULTA REAL A BLOCKCHAIN
        const confirmacionesActuales = await simularConsultaConfirmaciones(tx.txHash, tx.criptomoneda.red);
        
        if (confirmacionesActuales !== tx.confirmaciones) {
          await TransaccionBlockchain.updateConfirmations(tx.id, confirmacionesActuales);
          actualizadas.push({
            id: tx.id,
            txHash: tx.txHash,
            confirmacionesAnteriores: tx.confirmaciones,
            confirmacionesNuevas: confirmacionesActuales
          });
        }
      }

      console.log(`✅ Actualizadas ${actualizadas.length} transacciones`);
      return actualizadas;
    } catch (error) {
      console.error('❌ Error actualizando confirmaciones:', error);
      throw new Error(`Error al actualizar confirmaciones: ${error.message}`);
    }
  };

  TransaccionBlockchain.createDeposit = async (data) => {
    try {
      // Verificar que no existe ya una transacción con el mismo hash
      if (data.txHash) {
        const existingTx = await TransaccionBlockchain.findOne({
          where: { txHash: data.txHash }
        });
        
        if (existingTx) {
          throw new Error('Ya existe una transacción con este hash');
        }
      }

      const nuevoDeposito = await TransaccionBlockchain.create({
        ...data,
        tipo: 'deposito',
        estado: 'pendiente'
      });

      // Crear notificación inmediata
      const { Notificacion } = require('./index');
      await Notificacion.createNotification({
        usuarioId: data.usuarioId,
        tipo: 'transaccion',
        titulo: 'Depósito detectado',
        mensaje: `Se ha detectado un depósito de ${data.cantidad} ${data.criptomoneda?.symbol || 'crypto'} en tu cuenta. Confirmaciones: ${data.confirmaciones}/${data.confirmacionesRequeridas}`,
        importante: false,
        entidadTipo: 'transaccion_blockchain',
        entidadId: nuevoDeposito.id
      });

      return await TransaccionBlockchain.getById(nuevoDeposito.id);
    } catch (error) {
      throw new Error(`Error al crear depósito: ${error.message}`);
    }
  };

  // ================================
  // MÉTODOS AUTOMÁTICOS DE RETIROS
  // ================================

  TransaccionBlockchain.createWithdrawal = async (data) => {
    try {
      const { usuarioId, criptomonedaId, cantidad, direccionDestino } = data;

      // Verificar balance disponible
      const { BalanceUsuario } = require('./index');
      const hasBalance = await BalanceUsuario.hasAvailableBalance(usuarioId, criptomonedaId, cantidad);
      
      if (!hasBalance) {
        throw new Error('Balance insuficiente para este retiro');
      }

      // Bloquear balance del usuario inmediatamente
      await BalanceUsuario.blockBalance(usuarioId, criptomonedaId, cantidad);

      const nuevoRetiro = await TransaccionBlockchain.create({
        ...data,
        tipo: 'retiro',
        estado: 'pendiente', // Iniciará automáticamente el procesamiento
        confirmaciones: 0,
        requiereAprobacion: false, // Ya no requiere aprobación
        feeBlockchain: data.feeBlockchain || 0
      });

      // Procesar automáticamente el retiro
      setTimeout(() => {
        TransaccionBlockchain.processAutomaticWithdrawal(nuevoRetiro.id);
      }, 1000); // Procesar después de 1 segundo

      return await TransaccionBlockchain.getById(nuevoRetiro.id);
    } catch (error) {
      throw new Error(`Error al crear retiro: ${error.message}`);
    }
  };

  // Procesar retiro automáticamente
  TransaccionBlockchain.processAutomaticWithdrawal = async (transaccionId) => {
    try {
      console.log(`🚀 Procesando retiro automático: ${transaccionId}`);
      
      const transaccion = await TransaccionBlockchain.getById(transaccionId);
      
      if (!transaccion || transaccion.tipo !== 'retiro' || transaccion.estado !== 'pendiente') {
        console.log('❌ Retiro no válido para procesamiento automático');
        return;
      }

      // Cambiar estado a procesando
      await transaccion.update({ estado: 'procesando' });

      // AQUÍ IRÍA LA INTEGRACIÓN REAL CON WALLET PARA ENVIAR CRYPTO
      const txHash = await simularEnvioCrypto({
        criptomonedaId: transaccion.criptomonedaId,
        cantidad: transaccion.cantidad,
        direccionDestino: transaccion.direccionDestino,
        usuarioId: transaccion.usuarioId
      });

      // Actualizar con hash real de blockchain
      await transaccion.update({
        txHash: txHash,
        estado: 'confirmado'
      });

      // Restar del balance bloqueado (ya se envió)
      const { BalanceUsuario } = require('./index');
      await BalanceUsuario.updateBalance(
        transaccion.usuarioId,
        transaccion.criptomonedaId,
        -transaccion.cantidad,
        'bloqueado'
      );

      // Notificar al usuario
      const { Notificacion } = require('./index');
      await Notificacion.createNotification({
        usuarioId: transaccion.usuarioId,
        tipo: 'transaccion',
        titulo: 'Retiro procesado',
        mensaje: `Tu retiro de ${transaccion.cantidad} ${transaccion.criptomoneda?.symbol || 'crypto'} ha sido enviado a la blockchain. Hash: ${txHash}`,
        importante: false,
        entidadTipo: 'transaccion_blockchain',
        entidadId: transaccion.id
      });

      console.log(`✅ Retiro procesado exitosamente: ${txHash}`);
      return await TransaccionBlockchain.getById(transaccionId);
    } catch (error) {
      console.error(`❌ Error procesando retiro automático:`, error);
      
      // Marcar como fallido y desbloquear balance
      const transaccion = await TransaccionBlockchain.findByPk(transaccionId);
      if (transaccion) {
        await transaccion.update({ estado: 'fallido' });
        
        const { BalanceUsuario } = require('./index');
        await BalanceUsuario.unblockBalance(
          transaccion.usuarioId,
          transaccion.criptomonedaId,
          transaccion.cantidad
        );
      }
      
      throw error;
    }
  };

  // ================================
  // MÉTODOS DE ACTUALIZACIÓN DE ESTADO
  // ================================

  TransaccionBlockchain.updateConfirmations = async (id, confirmaciones) => {
    try {
      const transaccion = await TransaccionBlockchain.findByPk(id);
      if (!transaccion) {
        throw new Error('Transacción no encontrada');
      }

      const confirmacionesAnterior = transaccion.confirmaciones;
      transaccion.confirmaciones = confirmaciones;

      // Si alcanza las confirmaciones requeridas
      if (confirmaciones >= transaccion.confirmacionesRequeridas && transaccion.estado !== 'completado') {
        transaccion.estado = 'completado';

        // Para depósitos completados, actualizar balance del usuario
        if (transaccion.tipo === 'deposito') {
          const { BalanceUsuario } = require('./index');
          await BalanceUsuario.updateBalance(
            transaccion.usuarioId,
            transaccion.criptomonedaId,
            transaccion.cantidad,
            'disponible'
          );

          // Notificar completado
          const { Notificacion } = require('./index');
          await Notificacion.createNotification({
            usuarioId: transaccion.usuarioId,
            tipo: 'transaccion',
            titulo: 'Depósito completado',
            mensaje: `Tu depósito de ${transaccion.cantidad} ${transaccion.criptomoneda?.symbol || 'crypto'} ha sido confirmado y acreditado en tu cuenta.`,
            importante: true,
            entidadTipo: 'transaccion_blockchain',
            entidadId: transaccion.id
          });
        }
      }

      await transaccion.save();
      
      // Log de cambio de confirmaciones
      if (confirmacionesAnterior !== confirmaciones) {
        console.log(`🔄 Confirmaciones actualizadas para ${transaccion.txHash}: ${confirmacionesAnterior} → ${confirmaciones}`);
      }

      return await TransaccionBlockchain.getById(id);
    } catch (error) {
      throw new Error(`Error al actualizar confirmaciones: ${error.message}`);
    }
  };

  // ================================
  // MÉTODOS DE CONSULTA ESPECÍFICOS
  // ================================

  TransaccionBlockchain.getByUser = async (usuarioId, filters = {}) => {
    try {
      const whereClause = { usuarioId };
      
      if (filters.tipo) whereClause.tipo = filters.tipo;
      if (filters.estado) whereClause.estado = filters.estado;

      const transacciones = await TransaccionBlockchain.findAll({
        where: whereClause,
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'decimales']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: filters.limit || 50
      });

      return transacciones;
    } catch (error) {
      throw new Error(`Error al obtener transacciones por usuario: ${error.message}`);
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
            attributes: ['id', 'username', 'email']
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

  // ================================
  // MÉTODOS DE VALIDACIÓN
  // ================================

  TransaccionBlockchain.validateAddress = async (direccion, criptomonedaId) => {
    try {
      if (!direccion || direccion.length < 10) {
        return { valid: false, message: 'Dirección demasiado corta' };
      }

      const criptomoneda = await sequelize.models.Criptomoneda.findByPk(criptomonedaId);
      if (!criptomoneda) {
        return { valid: false, message: 'Criptomoneda no encontrada' };
      }

      // Validaciones básicas por red
      switch (criptomoneda.red) {
        case 'bitcoin':
          if (!direccion.match(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/)) {
            return { valid: false, message: 'Formato de dirección Bitcoin inválido' };
          }
          break;
        case 'ethereum':
        case 'erc20':
          if (!direccion.match(/^0x[a-fA-F0-9]{40}$/)) {
            return { valid: false, message: 'Formato de dirección Ethereum inválido' };
          }
          break;
      }

      return { valid: true, message: 'Dirección válida' };
    } catch (error) {
      return { valid: false, message: error.message };
    }
  };

  return TransaccionBlockchain;
}

// ================================
// FUNCIONES AUXILIARES PARA SIMULACIÓN
// ================================

// Simular escaneo de blockchain (reemplazar con integración real)
async function simularEscaneoBlockchain(direccion) {
  // Simular que a veces hay nuevas transacciones
  if (Math.random() > 0.95) { // 5% de probabilidad
    return [{
      txHash: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      cantidad: parseFloat((Math.random() * 0.1).toFixed(8)),
      direccionOrigen: `1${Math.random().toString(36).substr(2, 33)}`,
      confirmaciones: Math.floor(Math.random() * 3)
    }];
  }
  return [];
}

// Simular consulta de confirmaciones (reemplazar con integración real)
async function simularConsultaConfirmaciones(txHash, red) {
  // Simular que las confirmaciones van aumentando
  const hashNumber = parseInt(txHash.slice(-4), 16) || 1;
  const baseConfirmations = Math.floor(Date.now() / 30000) % 20; // Cambia cada 30 segundos
  return Math.min(baseConfirmations + (hashNumber % 3), getRequiredConfirmations(red));
}

// Simular envío de crypto (reemplazar con integración real)
async function simularEnvioCrypto(data) {
  // Simular demora de procesamiento
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Generar hash simulado
  const txHash = `sent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`💸 Simulando envío de ${data.cantidad} crypto a ${data.direccionDestino}: ${txHash}`);
  
  return txHash;
}

// Obtener confirmaciones requeridas por red
function getRequiredConfirmations(red) {
  switch (red) {
    case 'bitcoin': return 6;
    case 'ethereum': return 12;
    case 'erc20': return 12;
    default: return 6;
  }
}

module.exports = createTransaccionBlockchainModel;