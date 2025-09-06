const { MensajeReclamo } = require('../models/index.js');

// Listar mensajes de reclamos
const getMensajesReclamo = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await MensajeReclamo.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mensaje por ID
const getMensajeReclamoById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await MensajeReclamo.getById(id);
    if (!result) return res.status(404).json({ error: 'Mensaje de reclamo no encontrado' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear nuevo mensaje de reclamo
const createMensajeReclamo = async (req, res) => {
  try {
    const { reclamoId, mensaje, adjuntos } = req.body;
    const autorId = req.user.id;
    
    if (!reclamoId || !mensaje) {
      return res.status(400).json({ 
        error: 'Los campos reclamoId y mensaje son requeridos' 
      });
    }

    // Determinar si es admin basado en el rol del usuario
    const esAdmin = req.user.rol && ['ADMIN', 'SUPER_ADMIN'].includes(req.user.rol);

    const nuevoMensaje = await MensajeReclamo.createMensaje({
      reclamoId,
      autorId,
      mensaje,
      esAdmin,
      adjuntos
    });
    
    res.status(201).json({ 
      message: 'Mensaje de reclamo creado exitosamente', 
      data: nuevoMensaje 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualizar mensaje de reclamo por ID
const updateMensajeReclamo = async (req, res) => {
  try {
    const { id } = req.params;
    const { mensaje, adjuntos } = req.body;

    // Verificar que el usuario puede editar este mensaje
    const mensajeExistente = await MensajeReclamo.getById(id);
    if (!mensajeExistente) {
      return res.status(404).json({ error: 'Mensaje no encontrado' });
    }

    // Solo el autor o un admin pueden editar
    const isAdmin = req.user.rol && ['ADMIN', 'SUPER_ADMIN'].includes(req.user.rol);
    if (mensajeExistente.autorId !== req.user.id && !isAdmin) {
      return res.status(403).json({ error: 'No tienes permiso para editar este mensaje' });
    }

    const updatedMensaje = await MensajeReclamo.updateMensaje(id, {
      ...(mensaje && { mensaje }),
      ...(adjuntos !== undefined && { adjuntos })
    });

    res.json({ 
      message: 'Mensaje de reclamo actualizado exitosamente', 
      data: updatedMensaje 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Eliminar mensaje de reclamo por ID
const deleteMensajeReclamo = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar permisos similar a updateMensajeReclamo
    const mensajeExistente = await MensajeReclamo.getById(id);
    if (!mensajeExistente) {
      return res.status(404).json({ error: 'Mensaje no encontrado' });
    }

    const isAdmin = req.user.rol && ['ADMIN', 'SUPER_ADMIN'].includes(req.user.rol);
    if (mensajeExistente.autorId !== req.user.id && !isAdmin) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este mensaje' });
    }

    const result = await MensajeReclamo.deleteMensaje(id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Buscar mensajes de reclamos
const searchMensajesReclamo = async (req, res) => {
  try {
    const { q: term, limit = 10 } = req.query;
    
    if (!term) {
      return res.status(400).json({ error: 'Parámetro de búsqueda requerido' });
    }

    const result = await MensajeReclamo.search(term, limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas de mensajes de reclamos
const getMensajeReclamoStats = async (req, res) => {
  try {
    const stats = await MensajeReclamo.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mensajes por reclamo (conversación completa)
const getMensajesByReclamo = async (req, res) => {
  try {
    const { reclamoId } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.rol && ['ADMIN', 'SUPER_ADMIN'].includes(req.user.rol);
    
    const conversation = await MensajeReclamo.getConversation(
      reclamoId, 
      isAdmin ? null : userId, // Admins pueden ver cualquier conversación
      isAdmin // Incluir metadata solo para admins
    );
    
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mis mensajes (usuario autenticado)
const getMyMensajes = async (req, res) => {
  try {
    const autorId = req.user.id;
    const { limit = 100 } = req.query;
    
    const mensajes = await MensajeReclamo.getByAuthor(autorId, limit);
    res.json(mensajes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mensajes por autor (solo admin)
const getMensajesByAutor = async (req, res) => {
  try {
    const { autorId } = req.params;
    const { limit = 100 } = req.query;
    
    const mensajes = await MensajeReclamo.getByAuthor(autorId, limit);
    res.json(mensajes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mensajes de admin
const getMensajesAdmin = async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const mensajes = await MensajeReclamo.getAdminMessages(limit);
    res.json(mensajes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mensajes de usuarios
const getMensajesUsuarios = async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const mensajes = await MensajeReclamo.getUserMessages(limit);
    res.json(mensajes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mensajes con adjuntos
const getMensajesConAdjuntos = async (req, res) => {
  try {
    const mensajes = await MensajeReclamo.getMessagesWithAttachments();
    res.json({
      count: mensajes.length,
      mensajes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener actividad reciente
const getActividadReciente = async (req, res) => {
  try {
    const { timeframe = '24 hours' } = req.query;
    const mensajes = await MensajeReclamo.getRecentActivity(timeframe);
    
    res.json({
      timeframe,
      count: mensajes.length,
      mensajes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Marcar mensajes como leídos
const markMessagesAsRead = async (req, res) => {
  try {
    const { reclamoId } = req.params;
    const userId = req.user.id;
    
    const result = await MensajeReclamo.markAsRead(reclamoId, userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Dashboard de mensajes de reclamos
const getMensajesDashboard = async (req, res) => {
  try {
    const isAdmin = req.user.rol && ['ADMIN', 'SUPER_ADMIN'].includes(req.user.rol);
    
    // Obtener estadísticas generales
    const stats = await MensajeReclamo.getStats();
    
    // Actividad reciente
    const actividadReciente = await MensajeReclamo.getRecentActivity('24 hours');
    
    let dashboard = {
      stats,
      actividadReciente: {
        count: actividadReciente.length,
        mensajes: actividadReciente.slice(0, 5)
      }
    };

    if (isAdmin) {
      // Información adicional para admins
      const mensajesConAdjuntos = await MensajeReclamo.getMessagesWithAttachments();
      dashboard.mensajesConAdjuntos = {
        count: mensajesConAdjuntos.length,
        recent: mensajesConAdjuntos.slice(0, 3)
      };
    } else {
      // Información específica del usuario
      const misMensajes = await MensajeReclamo.getByAuthor(req.user.id, 5);
      dashboard.misMensajesRecientes = misMensajes;
    }
    
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Exportar mensajes a CSV (solo admin)
const exportMensajes = async (req, res) => {
  try {
    const filters = { ...req.query };
    const { mensajes } = await MensajeReclamo.getAll({
      ...filters,
      limit: 10000 // Límite alto para export
    });
    
    // Convertir a formato CSV
    const csvHeader = 'ID,Reclamo,Autor,Mensaje,Es Admin,Adjuntos,Fecha\n';
    const csvData = mensajes.map(mensaje => {
      const adjuntos = mensaje.adjuntos ? JSON.stringify(mensaje.adjuntos).replace(/,/g, ' ') : '';
      const mensajeText = (mensaje.mensaje || '').replace(/,/g, ' ').replace(/\n/g, ' ');
      return [
        mensaje.id,
        mensaje.reclamo ? mensaje.reclamo.titulo : '',
        mensaje.autor ? mensaje.autor.email : '',
        mensajeText,
        mensaje.esAdmin ? 'SI' : 'NO',
        adjuntos,
        mensaje.created_at
      ].join(',');
    }).join('\n');
    
    const csv = csvHeader + csvData;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="mensajes_reclamos.csv"');
    res.send(csv);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener métricas de respuesta (tiempo promedio de respuesta admin)
const getResponseMetrics = async (req, res) => {
  try {
    // Esta función requeriría una query más compleja para calcular tiempos de respuesta
    // Por ahora, devuelve estadísticas básicas
    const stats = await MensajeReclamo.getStats();
    const actividadReciente = await MensajeReclamo.getRecentActivity('7 days');
    
    const adminMessages = actividadReciente.filter(m => m.esAdmin);
    const userMessages = actividadReciente.filter(m => !m.esAdmin);
    
    res.json({
      ultimosSieteDias: {
        totalMensajes: actividadReciente.length,
        mensajesAdmin: adminMessages.length,
        mensajesUsuarios: userMessages.length,
        prome