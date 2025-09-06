// Importaciones
const initMetodoPago = require('./entities/metodoPago.entity');
const { Op } = require('sequelize');

function createMetodoPagoModel(sequelize) {
  const MetodoPago = initMetodoPago(sequelize);

  // Métodos de consulta básicos
  MetodoPago.getById = async (id) => {
    try {
      const metodoPago = await MetodoPago.findByPk(id);
      return metodoPago;
    } catch (error) {
      throw new Error(`Error al obtener método de pago por ID: ${error.message}`);
    }
  };

  MetodoPago.getAll = async (filters = {}) => {
    try {
      const whereClause = {};
      
      // Filtros disponibles
      if (filters.activo !== undefined) {
        whereClause.activo = filters.activo === 'true';
      }
      
      if (filters.nombre) {
        whereClause.nombre = {
          [Op.iLike]: `%${filters.nombre}%`
        };
      }

      const metodosPago = await MetodoPago.findAll({
        where: whereClause,
        order: [['nombre', 'ASC']]
      });
      
      return metodosPago;
    } catch (error) {
      throw new Error(`Error al obtener métodos de pago: ${error.message}`);
    }
  };

  MetodoPago.search = async (term, limit = 10) => {
    try {
      const metodosPago = await MetodoPago.findAll({
        where: {
          [Op.or]: [
            { nombre: { [Op.iLike]: `%${term}%` } },
            { descripcion: { [Op.iLike]: `%${term}%` } }
          ]
        },
        limit: parseInt(limit),
        order: [['nombre', 'ASC']]
      });
      
      return metodosPago;
    } catch (error) {
      throw new Error(`Error en búsqueda de métodos de pago: ${error.message}`);
    }
  };

  // Métodos específicos para métodos de pago
  MetodoPago.getActive = async () => {
    try {
      const metodosPago = await MetodoPago.findAll({
        where: { activo: true },
        order: [['nombre', 'ASC']]
      });
      return metodosPago;
    } catch (error) {
      throw new Error(`Error al obtener métodos de pago activos: ${error.message}`);
    }
  };

  MetodoPago.getInactive = async () => {
    try {
      const metodosPago = await MetodoPago.findAll({
        where: { activo: false },
        order: [['nombre', 'ASC']]
      });
      return metodosPago;
    } catch (error) {
      throw new Error(`Error al obtener métodos de pago inactivos: ${error.message}`);
    }
  };

  MetodoPago.getByName = async (nombre) => {
    try {
      const metodoPago = await MetodoPago.findOne({
        where: { 
          nombre: { [Op.iLike]: nombre }
        }
      });
      return metodoPago;
    } catch (error) {
      throw new Error(`Error al obtener método de pago por nombre: ${error.message}`);
    }
  };

  // Métodos de estadísticas
  MetodoPago.getStats = async () => {
    try {
      const totalMetodos = await MetodoPago.count();
      const metodosActivos = await MetodoPago.count({
        where: { activo: true }
      });
      const metodosInactivos = await MetodoPago.count({
        where: { activo: false }
      });

      return {
        total: totalMetodos,
        activos: metodosActivos,
        inactivos: metodosInactivos,
        porcentajeActivos: totalMetodos > 0 ? ((metodosActivos / totalMetodos) * 100).toFixed(2) : 0
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  };

  // Métodos CRUD
  MetodoPago.createMetodo = async (data) => {
    try {
      // Verificar si ya existe un método con el mismo nombre
      const existingMetodo = await MetodoPago.findOne({
        where: { 
          nombre: { [Op.iLike]: data.nombre }
        }
      });
      
      if (existingMetodo) {
        throw new Error('Ya existe un método de pago con ese nombre');
      }

      const nuevoMetodo = await MetodoPago.create(data);
      return nuevoMetodo;
    } catch (error) {
      throw new Error(`Error al crear método de pago: ${error.message}`);
    }
  };

  MetodoPago.updateMetodo = async (id, data) => {
    try {
      // Si se está actualizando el nombre, verificar que no exista
      if (data.nombre) {
        const existingMetodo = await MetodoPago.findOne({
          where: { 
            nombre: { [Op.iLike]: data.nombre },
            id: { [Op.ne]: id }
          }
        });
        
        if (existingMetodo) {
          throw new Error('Ya existe un método de pago con ese nombre');
        }
      }

      const [updatedRowsCount] = await MetodoPago.update(data, {
        where: { id },
        returning: true
      });
      
      if (updatedRowsCount === 0) {
        throw new Error('Método de pago no encontrado');
      }
      
      const updatedMetodo = await MetodoPago.getById(id);
      return updatedMetodo;
    } catch (error) {
      throw new Error(`Error al actualizar método de pago: ${error.message}`);
    }
  };

  MetodoPago.deleteMetodo = async (id) => {
    try {
      // Verificar si el método está siendo usado en transacciones o cuentas de usuario
      // Esta verificación dependerá de tus otras tablas
      // Ejemplo:
      // const transaccionesUsandoMetodo = await sequelize.models.TransaccionP2P.count({
      //   where: { metodoPagoId: id }
      // });
      
      // if (transaccionesUsandoMetodo > 0) {
      //   throw new Error('No se puede eliminar: método de pago en uso');
      // }

      const deletedRowsCount = await MetodoPago.destroy({
        where: { id }
      });
      
      if (deletedRowsCount === 0) {
        throw new Error('Método de pago no encontrado');
      }
      
      return { message: 'Método de pago eliminado correctamente' };
    } catch (error) {
      throw new Error(`Error al eliminar método de pago: ${error.message}`);
    }
  };

  // Métodos de gestión de estado
  MetodoPago.updateStatus = async (id, newStatus) => {
    try {
      const updated = await MetodoPago.updateMetodo(id, { activo: newStatus });
      return updated;
    } catch (error) {
      throw new Error(`Error al actualizar estado: ${error.message}`);
    }
  };

  // Métodos útiles para validaciones
  MetodoPago.isActive = async (id) => {
    try {
      const metodoPago = await MetodoPago.getById(id);
      return metodoPago && metodoPago.activo;
    } catch (error) {
      throw new Error(`Error al verificar estado: ${error.message}`);
    }
  };

  MetodoPago.validateForUse = async (id) => {
    try {
      const metodoPago = await MetodoPago.getById(id);
      
      if (!metodoPago) {
        throw new Error('Método de pago no encontrado');
      }

      if (!metodoPago.activo) {
        throw new Error('Método de pago inactivo');
      }

      return {
        valid: true,
        metodoPago: metodoPago,
        message: 'Método de pago válido'
      };
    } catch (error) {
      return {
        valid: false,
        message: error.message
      };
    }
  };

  // Método para obtener métodos populares (si tienes estadísticas de uso)
  MetodoPago.getPopular = async (limit = 5) => {
    try {
      // Esta función requeriría join con tablas de transacciones
      // Por ahora devuelve los métodos activos ordenados alfabéticamente
      const metodosPopulares = await MetodoPago.findAll({
        where: { activo: true },
        order: [['nombre', 'ASC']],
        limit: parseInt(limit)
      });
      
      return metodosPopulares;
    } catch (error) {
      throw new Error(`Error al obtener métodos populares: ${error.message}`);
    }
  };

  // Método para bulk operations
  MetodoPago.bulkUpdateStatus = async (ids, newStatus) => {
    try {
      const [updatedCount] = await MetodoPago.update(
        { activo: newStatus },
        {
          where: {
            id: { [Op.in]: ids }
          }
        }
      );

      return {
        message: `${updatedCount} métodos de pago actualizados`,
        updatedCount: updatedCount,
        newStatus: newStatus
      };
    } catch (error) {
      throw new Error(`Error en actualización masiva: ${error.message}`);
    }
  };

  // Método para exportar métodos
  MetodoPago.getForExport = async () => {
    try {
      const metodos = await MetodoPago.findAll({
        order: [['nombre', 'ASC']]
      });
      
      return metodos.map(metodo => ({
        id: metodo.id,
        nombre: metodo.nombre,
        descripcion: metodo.descripcion || '',
        activo: metodo.activo ? 'SI' : 'NO'
      }));
    } catch (error) {
      throw new Error(`Error al preparar datos para exportar: ${error.message}`);
    }
  };

  return MetodoPago;
}

module.exports = createMetodoPagoModel;