const { DataTypes, Model, Op } = require('sequelize');

class OfertaP2P extends Model {
  // Desactivar ofertas expiradas (más de 12 horas)
  static async deactivateExpiredOffers() {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    
    await this.update(
      { activa: false },
      {
        where: {
          activa: true,
          created_at: {
            [Op.lt]: twelveHoursAgo
          }
        }
      }
    );
  }

  // Obtener todas las ofertas con filtros
  static async getAll(filters = {}) {
    await this.deactivateExpiredOffers();

    const where = {};
    
    if (filters.activa !== undefined) {
      where.activa = filters.activa === 'true' || filters.activa === true;
    }
    if (filters.tipo) where.tipo = filters.tipo;
    if (filters.criptomonedaId) where.criptomonedaId = filters.criptomonedaId;
    if (filters.monedaFiat) where.monedaFiat = filters.monedaFiat;
    if (filters.usuarioId) where.usuarioId = filters.usuarioId;

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const offset = (page - 1) * limit;

    // Incluir métodos de pago en todas las consultas
    const includes = [
      {
        model: this.sequelize.models.MetodoPago,
        as: 'metodosPago',
        through: { attributes: [] }, // No incluir datos de la tabla intermedia
        attributes: ['id', 'nombre', 'descripcion', 'activo']
      }
    ];

    const { rows: data, count: total } = await this.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      include: includes,
      distinct: true // Importante para count correcto con include
    });

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Obtener oferta por ID
  static async getById(id) {
    const oferta = await this.findByPk(id, {
      include: [
        {
          model: this.sequelize.models.MetodoPago,
          as: 'metodosPago',
          through: { attributes: [] },
          attributes: ['id', 'nombre', 'descripcion', 'activo']
        }
      ]
    });
    
    if (oferta && oferta.activa) {
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
      if (oferta.created_at < twelveHoursAgo) {
        await oferta.update({ activa: false });
        oferta.activa = false;
      }
    }
    
    return oferta;
  }

  // Crear nueva oferta con métodos de pago
  static async createOffer(ofertaData) {
    const { tipo, direccionFiat, metodosPagoIds, ...restData } = ofertaData;

    // Validar dirección fiat obligatoria para ventas
    if (tipo === 'venta' && !direccionFiat) {
      throw new Error('La dirección de pago es obligatoria para ofertas de venta');
    }

    // Validar que cantidad mínima sea menor que máxima
    if (ofertaData.cantidadMin >= ofertaData.cantidadMax) {
      throw new Error('La cantidad mínima debe ser menor que la cantidad máxima');
    }

    // Validar que se proporcionen métodos de pago
    if (!metodosPagoIds || !Array.isArray(metodosPagoIds) || metodosPagoIds.length === 0) {
      throw new Error('Debe proporcionar al menos un método de pago');
    }

    // Validar que los métodos de pago existan y estén activos
    const metodosValidos = await this.sequelize.models.MetodoPago.findAll({
      where: {
        id: { [Op.in]: metodosPagoIds },
        activo: true
      }
    });

    if (metodosValidos.length !== metodosPagoIds.length) {
      throw new Error('Uno o más métodos de pago no existen o están inactivos');
    }

    // Crear la oferta
    const nuevaOferta = await this.create({
      ...restData,
      tipo,
      direccionFiat: tipo === 'venta' ? direccionFiat : null
    });

    // Crear las relaciones con métodos de pago
    const relacionesMetodos = metodosPagoIds.map(metodoPagoId => ({
      ofertaId: nuevaOferta.id,
      metodoPagoId
    }));

    await this.sequelize.models.OfertaMetodoPago.bulkCreate(relacionesMetodos);

    // Retornar oferta con métodos de pago incluidos
    return await this.getById(nuevaOferta.id);
  }

  // Actualizar oferta
  static async updateOffer(id, updateData, usuarioId) {
    const oferta = await this.findByPk(id);
    
    if (!oferta) {
      throw new Error('Oferta no encontrada');
    }

    if (oferta.usuarioId !== usuarioId) {
      throw new Error('No tienes permiso para actualizar esta oferta');
    }

    const { metodosPagoIds, ...restUpdateData } = updateData;

    // Validar dirección fiat si cambia a tipo venta
    if (updateData.tipo === 'venta' && !updateData.direccionFiat && !oferta.direccionFiat) {
      throw new Error('La dirección de pago es obligatoria para ofertas de venta');
    }

    // Validar cantidades si se actualizan
    const newMin = updateData.cantidadMin ?? oferta.cantidadMin;
    const newMax = updateData.cantidadMax ?? oferta.cantidadMax;
    if (newMin >= newMax) {
      throw new Error('La cantidad mínima debe ser menor que la cantidad máxima');
    }

    // Actualizar datos básicos de la oferta
    await oferta.update({
      ...restUpdateData,
      created_at: new Date() // Renovar fecha de publicación
    });

    // Si se proporcionan nuevos métodos de pago, actualizar
    if (metodosPagoIds && Array.isArray(metodosPagoIds)) {
      // Validar que haya al menos un método
      if (metodosPagoIds.length === 0) {
        throw new Error('Debe mantener al menos un método de pago');
      }

      // Validar que los métodos existan y estén activos
      const metodosValidos = await this.sequelize.models.MetodoPago.findAll({
        where: {
          id: { [Op.in]: metodosPagoIds },
          activo: true
        }
      });

      if (metodosValidos.length !== metodosPagoIds.length) {
        throw new Error('Uno o más métodos de pago no existen o están inactivos');
      }

      // Eliminar métodos antiguos
      await this.sequelize.models.OfertaMetodoPago.destroy({
        where: { ofertaId: id }
      });

      // Crear nuevas relaciones
      const relacionesMetodos = metodosPagoIds.map(metodoPagoId => ({
        ofertaId: id,
        metodoPagoId
      }));

      await this.sequelize.models.OfertaMetodoPago.bulkCreate(relacionesMetodos);
    }

    // Retornar oferta actualizada con métodos de pago
    return await this.getById(id);
  }

  // Agregar métodos de pago a una oferta existente
  static async addMetodosPago(ofertaId, metodosPagoIds, usuarioId) {
    const oferta = await this.findByPk(ofertaId);
    
    if (!oferta) {
      throw new Error('Oferta no encontrada');
    }

    if (oferta.usuarioId !== usuarioId) {
      throw new Error('No tienes permiso para modificar esta oferta');
    }

    if (!metodosPagoIds || !Array.isArray(metodosPagoIds) || metodosPagoIds.length === 0) {
      throw new Error('Debe proporcionar al menos un método de pago para agregar');
    }

    // Obtener métodos actuales
    const metodosActuales = await this.sequelize.models.OfertaMetodoPago.findAll({
      where: { ofertaId },
      attributes: ['metodoPagoId']
    });

    const metodosActualesIds = metodosActuales.map(m => m.metodoPagoId);

    // Filtrar solo métodos nuevos (que no existan ya)
    const metodosNuevos = metodosPagoIds.filter(id => !metodosActualesIds.includes(id));

    if (metodosNuevos.length === 0) {
      throw new Error('Todos los métodos de pago ya están asociados a esta oferta');
    }

    // Validar que los nuevos métodos existan y estén activos
    const metodosValidos = await this.sequelize.models.MetodoPago.findAll({
      where: {
        id: { [Op.in]: metodosNuevos },
        activo: true
      }
    });

    if (metodosValidos.length !== metodosNuevos.length) {
      throw new Error('Uno o más métodos de pago no existen o están inactivos');
    }

    // Crear nuevas relaciones
    const nuevasRelaciones = metodosNuevos.map(metodoPagoId => ({
      ofertaId,
      metodoPagoId
    }));

    await this.sequelize.models.OfertaMetodoPago.bulkCreate(nuevasRelaciones);

    return await this.getById(ofertaId);
  }

  // Eliminar métodos de pago de una oferta
  static async removeMetodosPago(ofertaId, metodosPagoIds, usuarioId) {
    const oferta = await this.findByPk(ofertaId);
    
    if (!oferta) {
      throw new Error('Oferta no encontrada');
    }

    if (oferta.usuarioId !== usuarioId) {
      throw new Error('No tienes permiso para modificar esta oferta');
    }

    if (!metodosPagoIds || !Array.isArray(metodosPagoIds) || metodosPagoIds.length === 0) {
      throw new Error('Debe proporcionar al menos un método de pago para eliminar');
    }

    // Verificar cuántos métodos tiene actualmente
    const metodosActuales = await this.sequelize.models.OfertaMetodoPago.count({
      where: { ofertaId }
    });

    // No permitir eliminar todos los métodos
    if (metodosActuales - metodosPagoIds.length < 1) {
      throw new Error('No puede eliminar todos los métodos de pago. Debe mantener al menos uno');
    }

    // Eliminar las relaciones especificadas
    await this.sequelize.models.OfertaMetodoPago.destroy({
      where: {
        ofertaId,
        metodoPagoId: { [Op.in]: metodosPagoIds }
      }
    });

    return await this.getById(ofertaId);
  }

  // Actualizar estado de oferta
  static async updateStatus(id, activa) {
    const oferta = await this.findByPk(id);
    
    if (!oferta) {
      throw new Error('Oferta no encontrada');
    }

    const updateData = { activa };
    if (activa === true) {
      updateData.created_at = new Date();
    }

    await oferta.update(updateData);
    return await this.getById(id);
  }

  // Buscar ofertas por término
  static async search(term, limit = 10) {
    await this.deactivateExpiredOffers();

    return await this.findAll({
      where: {
        activa: true,
        [Op.or]: [
          { condicionesAdicionales: { [Op.like]: `%${term}%` } },
          { monedaFiat: { [Op.like]: `%${term}%` } }
        ]
      },
      include: [
        {
          model: this.sequelize.models.MetodoPago,
          as: 'metodosPago',
          through: { attributes: [] },
          attributes: ['id', 'nombre', 'descripcion', 'activo']
        }
      ],
      limit,
      order: [['created_at', 'DESC']]
    });
  }

  // Historial de ofertas del usuario
  static async getUserOfferHistory(usuarioId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const { rows: data, count: total } = await this.findAndCountAll({
      where: { usuarioId },
      include: [
        {
          model: this.sequelize.models.MetodoPago,
          as: 'metodosPago',
          through: { attributes: [] },
          attributes: ['id', 'nombre', 'descripcion', 'activo']
        }
      ],
      limit,
      offset,
      order: [['created_at', 'DESC']],
      distinct: true
    });

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Encontrar ofertas compatibles
  static async findCompatibleOffers(tipo, criptomonedaId, cantidad, monedaFiat, metodoPagoId = null) {
    await this.deactivateExpiredOffers();

    const tipoOpuesto = tipo === 'compra' ? 'venta' : 'compra';

    const where = {
      activa: true,
      tipo: tipoOpuesto,
      criptomonedaId,
      monedaFiat,
      cantidadMin: { [Op.lte]: cantidad },
      cantidadMax: { [Op.gte]: cantidad }
    };

    const includeMetodos = {
      model: this.sequelize.models.MetodoPago,
      as: 'metodosPago',
      through: { attributes: [] },
      attributes: ['id', 'nombre', 'descripcion', 'activo']
    };

    // Si se especifica un método de pago, filtrar por ese método
    if (metodoPagoId) {
      includeMetodos.where = { id: metodoPagoId };
      includeMetodos.required = true;
    }

    const ofertas = await this.findAll({
      where,
      include: [includeMetodos],
      order: [['precio_unitario', tipo === 'compra' ? 'ASC' : 'DESC']],
      limit: 20
    });

    return ofertas;
  }

  // Verificar si se puede aceptar una oferta
  static async canAcceptOffer(id, cantidad) {
    const oferta = await this.getById(id);

    if (!oferta) {
      return { canAccept: false, reason: 'Oferta no encontrada' };
    }

    if (!oferta.activa) {
      return { canAccept: false, reason: 'Oferta inactiva o expirada' };
    }

    if (!oferta.metodosPago || oferta.metodosPago.length === 0) {
      return { canAccept: false, reason: 'La oferta no tiene métodos de pago disponibles' };
    }

    const cantidadNum = parseFloat(cantidad);
    
    if (cantidadNum < oferta.cantidadMin) {
      return { 
        canAccept: false, 
        reason: `Cantidad menor al mínimo (${oferta.cantidadMin})` 
      };
    }

    if (cantidadNum > oferta.cantidadMax) {
      return { 
        canAccept: false, 
        reason: `Cantidad mayor al máximo (${oferta.cantidadMax})` 
      };
    }

    return { canAccept: true, oferta };
  }

  // Obtener estadísticas
  static async getStats() {
    await this.deactivateExpiredOffers();

    const [totalOfertas, ofertasActivas, ofertasCompra, ofertasVenta] = await Promise.all([
      this.count(),
      this.count({ where: { activa: true } }),
      this.count({ where: { tipo: 'compra', activa: true } }),
      this.count({ where: { tipo: 'venta', activa: true } })
    ]);

    return {
      totalOfertas,
      ofertasActivas,
      ofertasInactivas: totalOfertas - ofertasActivas,
      ofertasCompra,
      ofertasVenta
    };
  }
}

function initOfertaP2P(sequelize) {
  OfertaP2P.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'usuario_id'
    },
    tipo: {
      type: DataTypes.ENUM('compra', 'venta'),
      allowNull: false
    },
    criptomonedaId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'criptomoneda_id'
    },
    cantidadMin: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'cantidad_min'
    },
    cantidadMax: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'cantidad_max'
    },
    precioUnitario: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
      field: 'precio_unitario'
    },
    monedaFiat: {
      type: DataTypes.STRING(3),
      allowNull: false,
      field: 'moneda_fiat'
    },
    direccionFiat: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'direccion_fiat',
      comment: 'CBU, CVU, Alias, email PayPal, etc. Obligatorio para ventas'
    },
    condicionesAdicionales: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'condiciones_adicionales'
    },
    activa: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'OfertaP2P',
    tableName: 'ofertas_p2p',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return OfertaP2P;
}

module.exports = initOfertaP2P;