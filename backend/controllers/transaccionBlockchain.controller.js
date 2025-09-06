const { TransaccionBlockchain, Usuario, Criptomoneda, BalanceUsuario, Notificacion } = require('../models/index.js');
const { Op } = require('sequelize');

// ================================
// MÉTODOS DE CONSULTA PARA USUARIOS
// ================================

// Obtener mis transacciones
const getMyTransacciones = async (req, res) => {
  try {
    const userId = req.user.id;
    const filters = { ...req.body };
    
    const transacciones = await TransaccionBlockchain.getByUser(userId, filters);
    
    res.json({
      transacciones,
      total: transacciones.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener transacción por ID
const getTransaccionById = async (req, res) => {
  try {
    const { id } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'ID de transacción requerido' });
    }

    const transaccion = await TransaccionBlockchain.getById(id);
    
    if (!transaccion) {
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }

    // Solo admins o el usuario dueño pueden ver la transacción
    if (req.user.rol === 'normal' && req.user.id !== transaccion.usuarioId) {
      return res.status(403).json({ error: 'Sin permisos para ver esta transacción' });
    }

    res.json(transaccion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener transacción por hash de blockchain
const getTransaccionByHash = async (req, res) => {
  try {
    const { txHash } = req.body;
    
    if (!txHash) {
      return res.status(400).json({ error: 'Hash de transacción requerido' });
    }

    const transaccion = await TransaccionBlockchain.getByTxHash(txHash);
    
    if (!transaccion) {
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }

    // Solo admins o el usuario dueño pueden ver la transacción
    if (req.user.rol === 'normal' && req.user.id !== transaccion.usuarioId) {
      return res.status(403).json({ error: 'Sin permisos para ver esta transacción' });
    }

    res.json(transaccion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Validar dirección de criptomoneda
const validateAddress = async (req, res) => {
  try {
    const { direccion, criptomonedaId } = req.body;
    
    if (!direccion || !criptomonedaId) {
      return res.status(400).json({ error: 'Dirección y criptomonedaId son requeridos' });
    }

    const validation = await TransaccionBlockchain.validateAddress(direccion, criptomonedaId);
    
    res.json(validation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ================================
// MÉTODOS DE RETIROS (AUTOMÁTICOS)
// ================================

// Crear solicitud de retiro (procesamiento automático)
const createRetiro = async (req, res) => {
  try {
    const userId = req.user.id;
    const { criptomonedaId, cantidad, direccionDestino, feeBlockchain } = req.body;
    
    // Validaciones básicas
    if (!criptomonedaId || !cantidad || !direccionDestino) {
      return res.status(400).json({ 
        error: 'Los campos criptomonedaId, cantidad y direccionDestino son requeridos' 
      });
    }

    if (cantidad <= 0) {
      return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
    }

    // Validar dirección de destino
    const addressValidation = await TransaccionBlockchain.validateAddress(direccionDestino, criptomonedaId);
    if (!addressValidation.valid) {
      return res.status(400).json({ error: addressValidation.message });
    }

    // Verificar límites diarios del usuario
    const limitCheck = await Usuario.canMakeTransaction(userId, cantidad);
    if (!limitCheck.canTransact) {
      return res.status(400).json({ error: limitCheck.reason });
    }

    // Crear y procesar retiro automáticamente
    const retiro = await TransaccionBlockchain.createWithdrawal({
      usuarioId: userId,
      criptomonedaId,
      cantidad: parseFloat(cantidad),
      direccionDestino,
      feeBlockchain: feeBlockchain || 0
    });

    res.status(201).json({
      message: 'Retiro creado y será procesado automáticamente',
      transaccion: retiro,
      info: 'El retiro se procesará en unos segundos. Recibirás una notificación cuando se complete.'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Cancelar retiro (solo si aún está pendiente)
const cancelRetiro = async (req, res) => {
  try {
    const { id } = req.body;
    const userId = req.user.id;

    if (!id) {
      return res.status(400).json({ error: 'ID de transacción requerido' });
    }

    const transaccion = await TransaccionBlockchain.getById(id);
    
    if (!transaccion) {
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }

    // Verificar que es del usuario
    if (transaccion.usuarioId !== userId) {
      return res.status(403).json({ error: 'Solo puedes cancelar tus propias transacciones' });
    }

    // Solo se pueden cancelar retiros pendientes (antes de procesarse)
    if (transaccion.tipo !== 'retiro') {
      return res.status(400).json({ error: 'Solo se pueden cancelar retiros' });
    }

    if (transaccion.estado !== 'pendiente') {
      return res.status(400).json({ 
        error: 'Solo se pueden cancelar retiros que aún no han sido procesados' 
      });
    }

    // Actualizar estado a cancelada
    await transaccion.update({ estado: 'fallido' });

    // Desbloquear balance del usuario
    await BalanceUsuario.unblockBalance(
      transaccion.usuarioId,
      transaccion.criptomonedaId,
      transaccion.cantidad
    );

    // Crear notificación
    await Notificacion.createNotification({
      usuarioId: userId,
      tipo: 'transaccion',
      titulo: 'Retiro cancelado',
      mensaje: `Tu retiro de ${transaccion.cantidad} ${transaccion.criptomoneda?.symbol || ''} ha sido cancelado. Los fondos han sido desbloqueados en tu cuenta.`,
      importante: false,
      entidadTipo: 'transaccion_blockchain',
      entidadId: transaccion.id
    });

    res.json({
      message: 'Retiro cancelado exitosamente',
      transaccion: await TransaccionBlockchain.getById(id)
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Obtener límites de retiro disponibles
const getWithdrawalLimits = async (req, res) => {
  try {
    const userId = req.user.id;
    const { criptomonedaId } = req.body;

    if (!criptomonedaId) {
      return res.status(400).json({ error: 'criptomonedaId es requerido' });
    }

    // Obtener balance disponible
    const balance = await BalanceUsuario.getByUserAndCrypto(userId, criptomonedaId);
    const balanceDisponible = balance ? parseFloat(balance.balanceDisponible) : 0;

    // Obtener límites del usuario
    const user = await Usuario.getById(userId);
    const limiteDiario = user.limiteDiarioUsd;

    // Calcular volumen usado hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const volumenHoy = await TransaccionBlockchain.findAll({
      attributes: [[sequelize.fn('SUM', sequelize.col('cantidad')), 'total']],
      where: {
        usuarioId: userId,
        tipo: 'retiro',
        estado: { [Op.in]: ['pendiente', 'procesando', 'confirmado', 'completado'] },
        created_at: {
          [Op.gte]: today,
          [Op.lt]: tomorrow
        }
      },
      raw: true
    });

    const volumenUsado = parseFloat(volumenHoy[0]?.total || 0);
    const limiteRestante = Math.max(0, limiteDiario - volumenUsado);

    res.json({
      balanceDisponible,
      limiteDiario,
      volumenUsado,
      limiteRestante,
      maxRetiro: Math.min(balanceDisponible, limiteRestante)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ================================
// MÉTODOS DEL SISTEMA AUTOMÁTICO
// ================================

// Escanear blockchain para nuevos depósitos
const scanBlockchainDeposits = async (req, res) => {
  try {
    // Solo admins pueden ejecutar escaneo manual
    /*if (req.user.rol !== 'admin' && req.user.rol !== 'super_admin') {
      return res.status(403).json({ error: 'Solo administradores pueden ejecutar escaneo de blockchain' });
    }*/

    const nuevosDepositos = await TransaccionBlockchain.scanForDeposits();
    
    res.json({
      message: `Escaneo completado. Encontrados ${nuevosDepositos.length} nuevos depósitos`,
      nuevosDepositos: nuevosDepositos.map(dep => ({
        id: dep.id,
        usuarioId: dep.usuarioId,
        cantidad: dep.cantidad,
        txHash: dep.txHash,
        criptomoneda: dep.criptomoneda?.symbol
      })),
      total: nuevosDepositos.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar confirmaciones de todas las transacciones
const updateAllConfirmations = async (req, res) => {
  try { 
    // Solo admins pueden ejecutar actualización masiva
    /*if (req.user.rol !== 'admin' && req.user.rol !== 'super_admin') {
      return res.status(403).json({ error: 'Solo administradores pueden actualizar confirmaciones masivamente' }); //<--- Volver a descomentar por seguridad!!
    }*/
    console.log("Después del comentario")
    const actualizadas = await TransaccionBlockchain.updateAllConfirmations();
    
    res.json({
      message: `Confirmaciones actualizadas. ${actualizadas.length} transacciones procesadas`,
      transaccionesActualizadas: actualizadas,
      total: actualizadas.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Registrar depósito manualmente (para casos especiales)
const registerManualDeposit = async (req, res) => {
  try {
    const { 
      usuarioId, 
      criptomonedaId, 
      cantidad, 
      txHash, 
      direccionOrigen, 
      direccionDestino,
      confirmacionesRequeridas = 6 
    } = req.body;

    // Solo admins pueden registrar depósitos manualmente
    if (req.user.rol !== 'admin' && req.user.rol !== 'super_admin') {
      return res.status(403).json({ error: 'Solo administradores pueden registrar depósitos manualmente' });
    }

    // Validaciones básicas
    if (!usuarioId || !criptomonedaId || !cantidad || !direccionDestino) {
      return res.status(400).json({ 
        error: 'Los campos usuarioId, criptomonedaId, cantidad y direccionDestino son requeridos' 
      });
    }

    if (cantidad <= 0) {
      return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
    }

    // Crear registro de depósito
    const deposito = await TransaccionBlockchain.createDeposit({
      usuarioId,
      criptomonedaId,
      cantidad: parseFloat(cantidad),
      txHash,
      direccionOrigen,
      direccionDestino,
      confirmacionesRequeridas: parseInt(confirmacionesRequeridas)
    });

    res.status(201).json({
      message: 'Depósito registrado manualmente',
      transaccion: deposito
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ================================
// MÉTODOS DE ADMINISTRACIÓN
// ================================

// Obtener todas las transacciones (admin)
const getAllTransacciones = async (req, res) => {
  try {
    // Solo admins pueden ver todas las transacciones
    if (req.user.rol !== 'admin' && req.user.rol !== 'super_admin') {
      return res.status(403).json({ error: 'Solo administradores pueden ver todas las transacciones' });
    }

    const filters = { ...req.body };
    const result = await TransaccionBlockchain.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas del sistema (admin)
const getSystemStats = async (req, res) => {
  try {
    // Solo admins pueden ver estadísticas
    if (req.user.rol !== 'admin' && req.user.rol !== 'super_admin') {
      return res.status(403).json({ error: 'Solo administradores pueden ver estadísticas del sistema' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Estadísticas del día
    const statsHoy = await TransaccionBlockchain.findAll({
      attributes: [
        'tipo',
        'estado',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
        [sequelize.fn('SUM', sequelize.col('cantidad')), 'volumen']
      ],
      where: {
        created_at: { [Op.gte]: today }
      },
      group: ['tipo', 'estado'],
      raw: true
    });

    // Transacciones pendientes
    const pendientes = await TransaccionBlockchain.count({
      where: { estado: { [Op.in]: ['pendiente', 'procesando'] } }
    });

    // Últimas transacciones
    const ultimasTransacciones = await TransaccionBlockchain.findAll({
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['username']
        },
        {
          model: Criptomoneda,
          as: 'criptomoneda',
          attributes: ['symbol']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: 10
    });

    res.json({
      estadisticasHoy: statsHoy,
      transaccionesPendientes: pendientes,
      ultimasTransacciones: ultimasTransacciones,
      resumen: {
        depositosHoy: statsHoy.filter(s => s.tipo === 'deposito').reduce((acc, s) => acc + parseInt(s.total), 0),
        retirosHoy: statsHoy.filter(s => s.tipo === 'retiro').reduce((acc, s) => acc + parseInt(s.total), 0),
        transaccionesPendientes: pendientes
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Forzar procesamiento de retiro específico (admin)
const forceProcessWithdrawal = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'ID de transacción requerido' });
    }

    // Solo super_admin puede forzar procesamiento
    if (req.user.rol !== 'super_admin') {
      return res.status(403).json({ error: 'Solo super administradores pueden forzar procesamiento' });
    }

    const transaccion = await TransaccionBlockchain.getById(id);
    
    if (!transaccion) {
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }

    if (transaccion.tipo !== 'retiro') {
      return res.status(400).json({ error: 'Solo se puede forzar el procesamiento de retiros' });
    }

    // Forzar procesamiento
    await TransaccionBlockchain.processAutomaticWithdrawal(id);
    
    res.json({
      message: 'Procesamiento de retiro forzado',
      transaccion: await TransaccionBlockchain.getById(id)
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  // Métodos de consulta para usuarios
  getMyTransacciones,
  getTransaccionById,
  getTransaccionByHash,
  validateAddress,
  
  // Métodos de retiros automáticos
  createRetiro,
  cancelRetiro,
  getWithdrawalLimits,
  
  // Métodos del sistema automático
  scanBlockchainDeposits,
  updateAllConfirmations,
  registerManualDeposit,
  
  // Métodos de administración
  getAllTransacciones,
  getSystemStats,
  forceProcessWithdrawal
};