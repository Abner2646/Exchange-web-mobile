// Importaciones
const initMetodoPago = require('./paymentMethod.entity');
const { Op } = require('sequelize');

function createMetodoPagoModel(sequelize) {
  const PaymentMethod = initMetodoPago(sequelize);

  // Métodos de consulta básicos
  PaymentMethod.getById = async (id) => {
    try {
      const metodoPago = await PaymentMethod.findByPk(id);
      return metodoPago;
    } catch (error) {
      throw new Error(`Error al obtener método de pago por ID: ${error.message}`);
    }
  };

  PaymentMethod.getAll = async (filters = {}) => {
    try {
      const whereClause = {};
      
      // Filtros disponibles
      if (filters.active !== undefined) {
        whereClause.active = filters.active === 'true';
      }
      
      if (filters.name) {
        whereClause.name = {
          [Op.iLike]: `%${filters.name}%`
        };
      }

      const metodosPago = await PaymentMethod.findAll({
        where: whereClause,
        order: [['name', 'ASC']]
      });
      
      return metodosPago;
    } catch (error) {
      throw new Error(`Error al obtener métodos de pago: ${error.message}`);
    }
  };

  PaymentMethod.search = async (term, limit = 10) => {
    try {
      const metodosPago = await PaymentMethod.findAll({
        where: {
          [Op.or]: [
            { name: { [Op.iLike]: `%${term}%` } },
            { description: { [Op.iLike]: `%${term}%` } }
          ]
        },
        limit: parseInt(limit),
        order: [['name', 'ASC']]
      });
      
      return metodosPago;
    } catch (error) {
      throw new Error(`Error en búsqueda de métodos de pago: ${error.message}`);
    }
  };

  // Métodos específicos para métodos de pago
  PaymentMethod.getActive = async () => {
    try {
      const metodosPago = await PaymentMethod.findAll({
        where: { active: true },
        order: [['name', 'ASC']]
      });
      return metodosPago;
    } catch (error) {
      throw new Error(`Error al obtener métodos de pago activos: ${error.message}`);
    }
  };

  PaymentMethod.getInactive = async () => {
    try {
      const metodosPago = await PaymentMethod.findAll({
        where: { active: false },
        order: [['name', 'ASC']]
      });
      return metodosPago;
    } catch (error) {
      throw new Error(`Error al obtener métodos de pago inactivos: ${error.message}`);
    }
  };

  PaymentMethod.getByName = async (name) => {
    try {
      const metodoPago = await PaymentMethod.findOne({
        where: { 
          name: { [Op.iLike]: name }
        }
      });
      return metodoPago;
    } catch (error) {
      throw new Error(`Error al obtener método de pago por nombre: ${error.message}`);
    }
  };

  // Métodos de estadísticas
  PaymentMethod.getStats = async () => {
    try {
      const totalMetodos = await PaymentMethod.count();
      const metodosActivos = await PaymentMethod.count({
        where: { active: true }
      });
      const metodosInactivos = await PaymentMethod.count({
        where: { active: false }
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
  PaymentMethod.createMetodo = async (data) => {
    try {
      // Verificar si ya existe un método con el mismo name
      const existingMetodo = await PaymentMethod.findOne({
        where: { 
          name: { [Op.iLike]: data.name }
        }
      });
      
      if (existingMetodo) {
        throw new Error('Ya existe un método de pago con ese nombre');
      }

      const nuevoMetodo = await PaymentMethod.create(data);
      return nuevoMetodo;
    } catch (error) {
      throw new Error(`Error al crear método de pago: ${error.message}`);
    }
  };

  PaymentMethod.updateMetodo = async (id, data) => {
    try {
      // Si se está actualizando el name, verificar que no exista
      if (data.name) {
        const existingMetodo = await PaymentMethod.findOne({
          where: { 
            name: { [Op.iLike]: data.name },
            id: { [Op.ne]: id }
          }
        });
        
        if (existingMetodo) {
          throw new Error('Ya existe un método de pago con ese nombre');
        }
      }

      const [updatedRowsCount] = await PaymentMethod.update(data, {
        where: { id },
        returning: true
      });
      
      if (updatedRowsCount === 0) {
        throw new Error('Método de pago no encontrado');
      }
      
      const updatedMetodo = await PaymentMethod.getById(id);
      return updatedMetodo;
    } catch (error) {
      throw new Error(`Error al actualizar método de pago: ${error.message}`);
    }
  };

  PaymentMethod.deleteMetodo = async (id) => {
    try {
      // Verificar si el método está siendo usado en transacciones o cuentas de usuario
      // Esta verificación dependerá de tus otras tablas
      // Ejemplo:
      // const transaccionesUsandoMetodo = await sequelize.models.P2PTransaction.count({
      //   where: { paymentMethodId: id }
      // });
      
      // if (transaccionesUsandoMetodo > 0) {
      //   throw new Error('No se puede eliminar: método de pago en uso');
      // }

      const deletedRowsCount = await PaymentMethod.destroy({
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

  // Métodos de gestión de status
  PaymentMethod.updateStatus = async (id, newStatus) => {
    try {
      const updated = await PaymentMethod.updateMetodo(id, { active: newStatus });
      return updated;
    } catch (error) {
      throw new Error(`Error al actualizar status: ${error.message}`);
    }
  };

  // Métodos útiles para validaciones
  PaymentMethod.isActive = async (id) => {
    try {
      const metodoPago = await PaymentMethod.getById(id);
      return metodoPago && metodoPago.active;
    } catch (error) {
      throw new Error(`Error al verificar status: ${error.message}`);
    }
  };

  PaymentMethod.validateForUse = async (id) => {
    try {
      const metodoPago = await PaymentMethod.getById(id);
      
      if (!metodoPago) {
        throw new Error('Método de pago no encontrado');
      }

      if (!metodoPago.active) {
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
  PaymentMethod.getPopular = async (limit = 5) => {
    try {
      // Esta función requeriría join con tablas de transacciones
      // Por ahora devuelve los métodos activos ordenados alfabéticamente
      const metodosPopulares = await PaymentMethod.findAll({
        where: { active: true },
        order: [['name', 'ASC']],
        limit: parseInt(limit)
      });
      
      return metodosPopulares;
    } catch (error) {
      throw new Error(`Error al obtener métodos populares: ${error.message}`);
    }
  };

  // Método para bulk operations
  PaymentMethod.bulkUpdateStatus = async (ids, newStatus) => {
    try {
      const [updatedCount] = await PaymentMethod.update(
        { active: newStatus },
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
  PaymentMethod.getForExport = async () => {
    try {
      const metodos = await PaymentMethod.findAll({
        order: [['name', 'ASC']]
      });
      
      return metodos.map(metodo => ({
        id: metodo.id,
        name: metodo.name,
        description: metodo.description || '',
        active: metodo.active ? 'SI' : 'NO'
      }));
    } catch (error) {
      throw new Error(`Error al preparar datos para exportar: ${error.message}`);
    }
  };

  return PaymentMethod;
}

module.exports = createMetodoPagoModel;