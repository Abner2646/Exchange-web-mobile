const { TransaccionP2P } = require('../models/index.js');

// Listar transacciones con filtros
const getTransacciones = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await TransaccionP2P.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener transacción por ID
const getTransaccionById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await TransaccionP2P.getById(id);
    if (!result) return res.status(404).json({ error: 'Transacción no encontrada' });

    // Verificar que el usuario tenga acceso a esta transacción
    const usuarioId = req.user.id;
    if (req.user.rol !== 'admin' && 
        result.compradorId !== usuarioId && 
        result.vendedorId !== usuarioId) {
      return res.status(403).json({ error: 'No tienes permiso para ver esta transacción' });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear nueva transacción (iniciar intercambio P2P)
const createTransaccion = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { 
      ofertaId, 
      cantidad, 
      metodoPagoId
    } = req.body;

    // Obtener datos de la oferta
    const { OfertaP2P } = require('../models/index.js');
    const oferta = await OfertaP2P.findByPk(ofertaId, {
      include: ['criptomoneda']
    });

    if (!oferta) {
      return res.status(404).json({ error: 'Oferta no encontrada' });
    }

    // 🆕 VALIDAR QUE NO SEA SU PROPIA OFERTA
    if (oferta.usuarioId === usuarioId) {
      return res.status(400).json({ 
        error: 'No puedes aceptar tu propia oferta' 
      });
    }

    // Determinar comprador y vendedor
    let compradorId, vendedorId;
    if (oferta.tipo === 'venta') {
      vendedorId = oferta.usuarioId;
      compradorId = usuarioId;
    } else {
      compradorId = oferta.usuarioId;
      vendedorId = usuarioId;
    }

    const transaccionData = {
      ofertaId,
      compradorId,
      vendedorId,
      criptomonedaId: oferta.criptomonedaId,
      cantidad,
      precioUnitario: oferta.precioUnitario,
      metodoPagoId
    };

    const nuevaTransaccion = await TransaccionP2P.createTransaction(transaccionData);
    
    res.status(201).json({
      message: 'Transacción iniciada exitosamente. Los fondos han sido bloqueados.',
      data: nuevaTransaccion
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualizar estado de transacción
const updateTransaccionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    const usuarioId = req.user.id;

    const updated = await TransaccionP2P.updateStatus(id, estado, usuarioId);
    res.json({ 
      message: 'Estado actualizado exitosamente', 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Bloquear criptomonedas (vendedor)
const lockCryptos = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    const updated = await TransaccionP2P.lockCryptos(id, usuarioId);
    res.json({ 
      message: 'Criptomonedas bloqueadas exitosamente', 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Confirmar pago (comprador)
const confirmPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    const updated = await TransaccionP2P.confirmPayment(id, usuarioId);
    res.json({ 
      message: 'Pago confirmado exitosamente', 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Completar transacción (vendedor)
const completeTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    const updated = await TransaccionP2P.completeTransaction(id, usuarioId);
    res.json({ 
      message: 'Transacción completada exitosamente', 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Cancelar transacción
const cancelTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    const updated = await TransaccionP2P.cancelTransaction(id, usuarioId);
    res.json({ 
      message: 'Transacción cancelada exitosamente', 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Obtener mis transacciones
const getMyTransacciones = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { page = 1, limit = 10, estado } = req.query;
    
    const whereCondition = {
      [Op.or]: [
        { compradorId: usuarioId },
        { vendedorId: usuarioId }
      ]
    };

    if (estado && estado !== 'todas') {
      whereCondition.estado = estado;
    }

    const { count, rows: transacciones } = await TransaccionP2P.findAndCountAll({
      where: whereCondition,
      include: [
        {
          model: Criptomoneda,
          as: 'criptomoneda',
          attributes: ['id', 'symbol', 'nombre', 'iconUrl']
        },
        {
          model: Usuario,
          as: 'comprador',
          attributes: ['id', 'username', 'reputacionPromedio']
        },
        {
          model: Usuario,
          as: 'vendedor',
          attributes: ['id', 'username', 'reputacionPromedio']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    // Agregar campo esComprador a cada transacción
    const transaccionesConRol = transacciones.map(t => ({
      ...t.toJSON(),
      esComprador: t.compradorId === usuarioId
    }));

    res.json({
      transacciones: transaccionesConRol,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error en getMyTransacciones:', error);
    res.status(500).json({ error: error.message });
  }
};

// Obtener transacciones pendientes
const getPendingTransacciones = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    
    const result = await TransaccionP2P.getPendingTransactions(usuarioId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas de transacciones (admin)
const getTransaccionesStats = async (req, res) => {
  try {
    const filters = req.query;
    const stats = await TransaccionP2P.getStats(filters);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener volumen de usuario
const getUserVolume = async (req, res) => {
  try {
    const usuarioId = req.params.usuarioId || req.user.id;
    const { period = '30d' } = req.query;

    // Si no es admin y no es su propio volumen, denegar acceso
    if (req.user.rol !== 'admin' && usuarioId !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para ver este volumen' });
    }

    const volume = await TransaccionP2P.getUserVolume(usuarioId, period);
    res.json(volume);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Verificar timeouts (tarea administrativa)
const checkTimeouts = async (req, res) => {
  try {
    const canceladas = await TransaccionP2P.checkTimeouts();
    res.json({ 
      message: `Se cancelaron ${canceladas} transacciones por timeout`,
      transaccionesCanceladas: canceladas
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener transacciones por oferta
const getTransaccionesByOferta = async (req, res) => {
  try {
    const { ofertaId } = req.params;
    const filters = { ...req.query, ofertaId };

    const result = await TransaccionP2P.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener historial de transacciones con usuario específico
const getTransactionHistory = async (req, res) => {
  try {
    const { otroUsuarioId } = req.params;
    const usuarioId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const filters = {
      page: parseInt(page),
      limit: parseInt(limit)
    };

    // Filtrar transacciones donde el usuario actual y el otro usuario participaron
    const result = await TransaccionP2P.getAll({
      ...filters,
      where: {
        [Op.or]: [
          { compradorId: usuarioId, vendedorId: otroUsuarioId },
          { compradorId: otroUsuarioId, vendedorId: usuarioId }
        ]
      }
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Forzar cambio de estado (solo admin)
const forceStatusChange = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, motivo } = req.body;

    // Solo admin puede forzar cambios de estado
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden forzar cambios de estado' });
    }

    const transaccion = await TransaccionP2P.findByPk(id);
    if (!transaccion) {
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }

    const updateData = { estado };
    
    // Agregar timestamps según el nuevo estado
    switch (estado) {
      case 'pago_confirmado':
        updateData.fechaPagoConfirmado = new Date();
        break;
      case 'completada':
        updateData.fechaCompletada = new Date();
        break;
    }

    await transaccion.update(updateData);

    // Registrar la acción administrativa si tienes un modelo de logs
    // await LogAdmin.create({
    //   adminId: req.user.id,
    //   accion: 'FORZAR_ESTADO_TRANSACCION',
    //   detalles: { transaccionId: id, estadoAnterior: transaccion.estado, nuevoEstado: estado, motivo }
    // });

    const updated = await TransaccionP2P.getById(id);
    res.json({ 
      message: 'Estado forzado exitosamente', 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getTransacciones,
  getTransaccionById,
  createTransaccion,
  updateTransaccionStatus,
  lockCryptos,
  confirmPayment,
  completeTransaction,
  cancelTransaction,
  getMyTransacciones,
  getPendingTransacciones,
  getTransaccionesStats,
  getUserVolume,
  checkTimeouts,
  getTransaccionesByOferta,
  getTransactionHistory,
  forceStatusChange
};