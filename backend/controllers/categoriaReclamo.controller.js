const { CategoriaReclamo } = require('../models/index.js');

// Listar categorías de reclamo
const getCategorias = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await CategoriaReclamo.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener categoría por ID
const getCategoriaById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await CategoriaReclamo.getById(id);
    if (!result) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear nueva categoría
const createCategoria = async (req, res) => {
  try {
    const { nombre, descripcion, activa = true } = req.body;
    
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const nuevaCategoria = await CategoriaReclamo.createCategoria({
      nombre,
      descripcion,
      activa
    });
    
    res.status(201).json({ 
      message: 'Categoría creada exitosamente', 
      data: nuevaCategoria 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualizar categoría por ID
const updateCategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, activa } = req.body;

    const updatedCategoria = await CategoriaReclamo.updateCategoria(id, {
      ...(nombre && { nombre }),
      ...(descripcion !== undefined && { descripcion }),
      ...(activa !== undefined && { activa })
    });

    res.json({ 
      message: 'Categoría actualizada exitosamente', 
      data: updatedCategoria 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Eliminar categoría por ID
const deleteCategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await CategoriaReclamo.deleteCategoria(id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualizar estado de categoría
const updateCategoriaStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { activa } = req.body;
    
    if (typeof activa !== 'boolean') {
      return res.status(400).json({ error: 'El campo activa debe ser un valor booleano' });
    }

    const updated = await CategoriaReclamo.updateStatus(id, activa);
    res.json({ 
      message: `Categoría ${activa ? 'activada' : 'desactivada'} exitosamente`, 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Alternar estado de categoría
const toggleCategoriaStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const categoria = await CategoriaReclamo.getById(id);
    
    if (!categoria) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    const newStatus = !categoria.activa;
    const updated = await CategoriaReclamo.updateStatus(id, newStatus);
    
    res.json({ 
      message: `Categoría ${newStatus ? 'activada' : 'desactivada'} exitosamente`, 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Buscar categorías
const searchCategorias = async (req, res) => {
  try {
    const { q: term, limit = 10 } = req.query;
    
    if (!term) {
      return res.status(400).json({ error: 'Parámetro de búsqueda requerido' });
    }

    const result = await CategoriaReclamo.search(term, limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas de categorías
const getCategoriaStats = async (req, res) => {
  try {
    const stats = await CategoriaReclamo.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener solo categorías activas
const getCategoriasActivas = async (req, res) => {
  try {
    const categorias = await CategoriaReclamo.getActive();
    res.json(categorias);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getCategorias,
  getCategoriaById,
  createCategoria,
  updateCategoria,
  deleteCategoria,
  updateCategoriaStatus,
  toggleCategoriaStatus,
  searchCategorias,
  getCategoriaStats,
  getCategoriasActivas
};