// Importaciones
const initCategoriaReclamo = require('./entities/categoriaReclamo.entity');
const { Op } = require('sequelize');

function createCategoriaReclamoModel(sequelize) {
  const CategoriaReclamo = initCategoriaReclamo(sequelize);

  // Métodos de consulta básicos
  CategoriaReclamo.getById = async (id) => {
    try {
      const categoria = await CategoriaReclamo.findByPk(id);
      return categoria;
    } catch (error) {
      throw new Error(`Error al obtener categoría por ID: ${error.message}`);
    }
  };

  CategoriaReclamo.getAll = async (filters = {}) => {
    try {
      const whereClause = {};
      
      // Filtros disponibles
      if (filters.activa !== undefined) {
        whereClause.activa = filters.activa === 'true';
      }
      
      if (filters.nombre) {
        whereClause.nombre = {
          [Op.iLike]: `%${filters.nombre}%`
        };
      }

      const categorias = await CategoriaReclamo.findAll({
        where: whereClause,
        order: [['nombre', 'ASC']]
      });
      
      return categorias;
    } catch (error) {
      throw new Error(`Error al obtener categorías: ${error.message}`);
    }
  };

  CategoriaReclamo.search = async (term, limit = 10) => {
    try {
      const categorias = await CategoriaReclamo.findAll({
        where: {
          [Op.and]: [
            { activa: true },
            {
              [Op.or]: [
                { nombre: { [Op.iLike]: `%${term}%` } },
                { descripcion: { [Op.iLike]: `%${term}%` } }
              ]
            }
          ]
        },
        limit: parseInt(limit),
        order: [['nombre', 'ASC']]
      });
      
      return categorias;
    } catch (error) {
      throw new Error(`Error en búsqueda de categorías: ${error.message}`);
    }
  };

  // Métodos administrativos
  CategoriaReclamo.updateStatus = async (id, newStatus) => {
    try {
      const [updatedRowsCount] = await CategoriaReclamo.update(
        { activa: newStatus },
        { 
          where: { id },
          returning: true
        }
      );
      
      if (updatedRowsCount === 0) {
        throw new Error('Categoría no encontrada');
      }
      
      const updatedCategoria = await CategoriaReclamo.getById(id);
      return updatedCategoria;
    } catch (error) {
      throw new Error(`Error al actualizar estado: ${error.message}`);
    }
  };

  CategoriaReclamo.getStats = async () => {
    try {
      const totalCategorias = await CategoriaReclamo.count();
      const categoriasActivas = await CategoriaReclamo.count({
        where: { activa: true }
      });
      const categoriasInactivas = await CategoriaReclamo.count({
        where: { activa: false }
      });

      return {
        total: totalCategorias,
        activas: categoriasActivas,
        inactivas: categoriasInactivas
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  };

  // Métodos específicos para categorías de reclamo
  CategoriaReclamo.getActive = async () => {
    try {
      const categorias = await CategoriaReclamo.findAll({
        where: { activa: true },
        order: [['nombre', 'ASC']]
      });
      return categorias;
    } catch (error) {
      throw new Error(`Error al obtener categorías activas: ${error.message}`);
    }
  };

  CategoriaReclamo.createCategoria = async (data) => {
    try {
      // Verificar si ya existe una categoría con el mismo nombre
      const existingCategoria = await CategoriaReclamo.findOne({
        where: { nombre: data.nombre }
      });
      
      if (existingCategoria) {
        throw new Error('Ya existe una categoría con ese nombre');
      }

      const nuevaCategoria = await CategoriaReclamo.create(data);
      return nuevaCategoria;
    } catch (error) {
      throw new Error(`Error al crear categoría: ${error.message}`);
    }
  };

  CategoriaReclamo.updateCategoria = async (id, data) => {
    try {
      // Si se está actualizando el nombre, verificar que no exista
      if (data.nombre) {
        const existingCategoria = await CategoriaReclamo.findOne({
          where: { 
            nombre: data.nombre,
            id: { [Op.ne]: id }
          }
        });
        
        if (existingCategoria) {
          throw new Error('Ya existe una categoría con ese nombre');
        }
      }

      const [updatedRowsCount] = await CategoriaReclamo.update(data, {
        where: { id },
        returning: true
      });
      
      if (updatedRowsCount === 0) {
        throw new Error('Categoría no encontrada');
      }
      
      const updatedCategoria = await CategoriaReclamo.getById(id);
      return updatedCategoria;
    } catch (error) {
      throw new Error(`Error al actualizar categoría: ${error.message}`);
    }
  };

  CategoriaReclamo.deleteCategoria = async (id) => {
    try {
      const deletedRowsCount = await CategoriaReclamo.destroy({
        where: { id }
      });
      
      if (deletedRowsCount === 0) {
        throw new Error('Categoría no encontrada');
      }
      
      return { message: 'Categoría eliminada correctamente' };
    } catch (error) {
      throw new Error(`Error al eliminar categoría: ${error.message}`);
    }
  };

  return CategoriaReclamo;
}

module.exports = createCategoriaReclamoModel;