const { MetodoPago } = require('../models/index.js');

// Listar métodos de pago
const getMetodosPago = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await MetodoPago.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener método de pago por ID
const getMetodoPagoById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await MetodoPago.getById(id);
    if (!result) return res.status(404).json({ error: 'Método de pago no encontrado' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear nuevo método de pago
const createMetodoPago = async (req, res) => {
  try {
    const { nombre, descripcion, activo = true } = req.body;
    
    if (!nombre) {
      return res.status(400).json({ 
        error: 'El nombre es requerido' 
      });
    }

    const nuevoMetodo = await MetodoPago.createMetodo({
      nombre,
      descripcion,
      activo
    });
    
    res.status(201).json({ 
      message: 'Método de pago creado exitosamente', 
      data: nuevoMetodo 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualizar método de pago por ID
const updateMetodoPago = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, activo } = req.body;

    const updatedMetodo = await MetodoPago.updateMetodo(id, {
      ...(nombre && { nombre }),
      ...(descripcion !== undefined && { descripcion }),
      ...(activo !== undefined && { activo })
    });

    res.json({ 
      message: 'Método de pago actualizado exitosamente', 
      data: updatedMetodo 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Eliminar método de pago por ID
const deleteMetodoPago = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await MetodoPago.deleteMetodo(id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Buscar métodos de pago
const searchMetodosPago = async (req, res) => {
  try {
    const { q: term, limit = 10 } = req.query;
    
    if (!term) {
      return res.status(400).json({ error: 'Parámetro de búsqueda requerido' });
    }

    const result = await MetodoPago.search(term, limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas de métodos de pago
const getMetodoPagoStats = async (req, res) => {
  try {
    const stats = await MetodoPago.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener métodos de pago activos
const getActiveMetodosPago = async (req, res) => {
  try {
    const metodos = await MetodoPago.getActive();
    res.json(metodos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener métodos de pago inactivos
const getInactiveMetodosPago = async (req, res) => {
  try {
    const metodos = await MetodoPago.getInactive();
    res.json(metodos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener método de pago por nombre
const getMetodoPagoByName = async (req, res) => {
  try {
    const { nombre } = req.params;
    const metodo = await MetodoPago.getByName(nombre);
    
    if (!metodo) {
      return res.status(404).json({ 
        error: 'Método de pago no encontrado con ese nombre' 
      });
    }
    
    res.json(metodo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar estado de método de pago
const updateMetodoPagoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;
    
    if (typeof activo !== 'boolean') {
      return res.status(400).json({ error: 'El campo activo debe ser un valor booleano' });
    }

    const updated = await MetodoPago.updateStatus(id, activo);
    res.json({ 
      message: `Método de pago ${activo ? 'activado' : 'desactivado'} exitosamente`, 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Alternar estado de método de pago
const toggleMetodoPagoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const metodo = await MetodoPago.getById(id);
    
    if (!metodo) {
      return res.status(404).json({ error: 'Método de pago no encontrado' });
    }

    const newStatus = !metodo.activo;
    const updated = await MetodoPago.updateStatus(id, newStatus);
    
    res.json({ 
      message: `Método de pago ${newStatus ? 'activado' : 'desactivado'} exitosamente`, 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Validar método de pago para uso
const validateMetodoPago = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await MetodoPago.validateForUse(id);
    
    if (result.valid) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener métodos de pago populares
const getPopularMetodosPago = async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const metodos = await MetodoPago.getPopular(parseInt(limit));
    res.json(metodos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualización masiva de estado
const bulkUpdateStatus = async (req, res) => {
  try {
    const { ids, activo } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ 
        error: 'Se requiere un array de IDs' 
      });
    }

    if (typeof activo !== 'boolean') {
      return res.status(400).json({ 
        error: 'El campo activo debe ser un valor booleano' 
      });
    }

    const result = await MetodoPago.bulkUpdateStatus(ids, activo);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Dashboard de métodos de pago
const getMetodosPagoDashboard = async (req, res) => {
  try {
    const stats = await MetodoPago.getStats();
    const metodosActivos = await MetodoPago.getActive();
    const metodosInactivos = await MetodoPago.getInactive();
    const metodosPopulares = await MetodoPago.getPopular(3);
    
    res.json({
      estadisticas: stats,
      resumen: {
        totalMetodos: stats.total,
        activosCount: stats.activos,
        inactivosCount: stats.inactivos,
        porcentajeActivos: stats.porcentajeActivos + '%'
      },
      metodosRecientes: {
        activos: metodosActivos.slice(0, 5),
        inactivos: metodosInactivos.slice(0, 3)
      },
      metodosPopulares: metodosPopulares,
      recomendaciones: {
        totalDisponible: metodosActivos.length,
        necesitaAtencion: metodosInactivos.length > 0 ? `${metodosInactivos.length} métodos inactivos` : null
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Exportar métodos de pago a CSV
const exportMetodosPago = async (req, res) => {
  try {
    const metodos = await MetodoPago.getForExport();
    
    // Convertir a formato CSV
    const csvHeader = 'ID,Nombre,Descripcion,Activo\n';
    const csvData = metodos.map(metodo => {
      const descripcion = (metodo.descripcion || '').replace(/,/g, ' ').replace(/\n/g, ' ');
      return [
        metodo.id,
        metodo.nombre,
        descripcion,
        metodo.activo
      ].join(',');
    }).join('\n');
    
    const csv = csvHeader + csvData;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="metodos_pago.csv"');
    res.send(csv);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Verificar si método está activo (útil para validaciones rápidas)
const checkMetodoActive = async (req, res) => {
  try {
    const { id } = req.params;
    const isActive = await MetodoPago.isActive(id);
    
    res.json({
      id: id,
      activo: isActive,
      message: isActive ? 'Método de pago activo' : 'Método de pago inactivo o no encontrado'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener métodos de pago para formularios (solo nombre e id de activos)
const getMetodosForForm = async (req, res) => {
  try {
    const metodos = await MetodoPago.getActive();
    const metodosForm = metodos.map(metodo => ({
      id: metodo.id,
      nombre: metodo.nombre,
      descripcion: metodo.descripcion
    }));
    
    res.json(metodosForm);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener resumen rápido
const getQuickSummary = async (req, res) => {
  try {
    const stats = await MetodoPago.getStats();
    
    res.json({
      total: stats.total,
      activos: stats.activos,
      disponibles: stats.activos > 0,
      porcentajeDisponibilidad: stats.porcentajeActivos
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getMetodosPago,
  getMetodoPagoById,
  createMetodoPago,
  updateMetodoPago,
  deleteMetodoPago,
  searchMetodosPago,
  getMetodoPagoStats,
  getActiveMetodosPago,
  getInactiveMetodosPago,
  getMetodoPagoByName,
  updateMetodoPagoStatus,
  toggleMetodoPagoStatus,
  validateMetodoPago,
  getPopularMetodosPago,
  bulkUpdateStatus,
  getMetodosPagoDashboard,
  exportMetodosPago,
  checkMetodoActive,
  getMetodosForForm,
  getQuickSummary
};