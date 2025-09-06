const { Reclamo, MensajeReclamo } = require('../models/index.js');

// Listar reclamos
const getReclamos = async (req, res) => {
  try {
    const filters = { ...req.query };
    
    // Si no es admin, solo ver sus propios reclamos
    const isAdmin = req.user.rol && ['ADMIN', 'SUPER_ADMIN'].includes(req.user.rol);
    if (!isAdmin) {
      filters.userId = req.user.id;
    }

    const result = await Reclamo.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener reclamo por ID
const getReclamoById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Reclamo.getById(id);
    
    if (!result) {
      return res.status(404).json({ error: 'Reclamo no encontrado' });
    }

    // Verificar permisos: propietario o admin
    const isAdmin = req.user.rol && ['ADMIN', 'SUPER_ADMIN'].includes(req.user.rol);
    if (!isAdmin && result.userId !== req.user.id) {
      return res.status(403).json({ error: 'No tienes acceso a este reclamo' });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear nuevo reclamo
const createReclamo = async (req, res) => {
  try {
    const { categoriaId, tipoReclamo, transaccionP2PId, asunto, descripcion, prioridad } = req.body;
    const userId = req.user.id;
    
    if (!categoriaId || !tipoReclamo || !asunto || !descripcion) {
      return res.status(400).json({ 
        error: 'Los campos categoriaId, tipoReclamo, asunto y descripcion son requeridos' 
      });
    }

    // Validar tipo P2P
    if (tipoReclamo === 'p2p' && !transaccionP2PId) {
      return res.status(400).json({ 
        error: 'transaccionP2PId es requerido para reclamos tipo P2P' 
      });
    }

    const nuevoReclamo = await Reclamo.createReclamo({
      userId,
      categoriaId,
      tipoReclamo,
      transaccionP2PId,
      asunto,
      descripcion,
      prioridad: prioridad || 'media'
    });

    // Crear mensaje inicial automáticamente
    await MensajeReclamo.createMensaje({
      reclamoId: nuevoReclamo.id,
      autorId: userId,
      mensaje: descripcion,
      esAdmin: false
    });
    
    res.status(201).json({ 
      message: 'Reclamo creado exitosamente', 
      data: nuevoReclamo 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualizar reclamo por ID
const updateReclamo = async (req, res) => {
  try {
    const { id } = req.params;
    const { asunto, descripcion, prioridad } = req.body;

    // Verificar permisos
    const reclamoExistente = await Reclamo.getById(id);
    if (!reclamoExistente) {
      return res.status(404).json({ error: 'Reclamo no encontrado' });
    }

    const isAdmin = req.user.rol && ['ADMIN', 'SUPER_ADMIN'].includes(req.user.rol);
    
    // Los usuarios solo pueden editar sus reclamos si están pendientes
    if (!isAdmin) {
      if (reclamoExistente.userId !== req.user.id) {
        return res.status(403).json({ error: 'No tienes acceso a este reclamo' });
      }
      if (reclamoExistente.estado !== 'pendiente') {
        return res.status(400).json({ error: 'Solo puedes editar reclamos pendientes' });
      }
    }

    const updatedReclamo = await Reclamo.updateReclamo(id, {
      ...(asunto && { asunto }),
      ...(descripcion && { descripcion }),
      ...(prioridad && isAdmin && { prioridad }) // Solo admin puede cambiar prioridad
    });

    res.json({ 
      message: 'Reclamo actualizado exitosamente', 
      data: updatedReclamo 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Eliminar reclamo por ID (solo admin)
const deleteReclamo = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Reclamo.deleteReclamo(id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Buscar reclamos
const searchReclamos = async (req, res) => {
  try {
    const { q: term, limit = 10 } = req.query;
    
    if (!term) {
      return res.status(400).json({ error: 'Parámetro de búsqueda requerido' });
    }

    const result = await Reclamo.search(term, limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas de reclamos
const getReclamoStats = async (req, res) => {
  try {
    const stats = await Reclamo.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mis reclamos (usuario autenticado)
const getMyReclamos = async (req, res) => {
  try {
    const userId = req.user.id;
    const filters = { ...req.query };
    
    const reclamos = await Reclamo.getByUser(userId, filters);
    res.json(reclamos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener reclamos por usuario (solo admin)
const getReclamosByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const filters = { ...req.query };
    
    const reclamos = await Reclamo.getByUser(userId, filters);
    res.json(reclamos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener reclamos asignados a mí (admin)
const getMyAssignedReclamos = async (req, res) => {
  try {
    const adminId = req.user.id;
    const filters = { ...req.query };
    
    const reclamos = await Reclamo.getByAdmin(adminId, filters);
    res.json(reclamos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener reclamos por estado
const getReclamosByStatus = async (req, res) => {
  try {
    const { estado } = req.params;
    const reclamos = await Reclamo.getByStatus(estado);
    res.json(reclamos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener reclamos por prioridad
const getReclamosByPriority = async (req, res) => {
  try {
    const { prioridad } = req.params;
    const reclamos = await Reclamo.getByPriority(prioridad);
    res.json(reclamos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener reclamos sin asignar
const getUnassignedReclamos = async (req, res) => {
  try {
    const reclamos = await Reclamo.getUnassigned();
    res.json(reclamos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener reclamos vencidos
const getOverdueReclamos = async (req, res) => {
  try {
    const { days = 3 } = req.query;
    const reclamos = await Reclamo.getOverdue(parseInt(days));
    res.json(reclamos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Asignar reclamo a admin
const assignReclamoToAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;
    
    if (!adminId) {
      return res.status(400).json({ error: 'adminId es requerido' });
    }

    const updated = await Reclamo.assignToAdmin(id, adminId);
    res.json({ 
      message: 'Reclamo asignado exitosamente', 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Auto-asignar reclamo a mí (admin)
const assignReclamoToMe = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    
    const updated = await Reclamo.assignToAdmin(id, adminId);
    res.json({ 
      message: 'Reclamo asignado a ti exitosamente', 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualizar estado del reclamo
const updateReclamoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, resolucion } = req.body;
    
    if (!estado) {
      return res.status(400).json({ error: 'estado es requerido' });
    }

    // Verificar permisos para cambiar