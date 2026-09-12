const { DataTypes, Model, Op } = require('sequelize');
const money = require('../../utils/money');

class P2POffer extends Model {
  // Desactivar ofertas expiradas (más de 12 horas)
  static async deactivateExpiredOffers() {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    
    await this.update(
      { active: false },
      {
        where: {
          active: true,
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
    
    if (filters.active !== undefined) {
      where.active = filters.active === 'true' || filters.active === true;
    }
    if (filters.type) where.type = filters.type;
    if (filters.cryptoId) where.cryptoId = filters.cryptoId;
    if (filters.fiatCurrency) where.fiatCurrency = filters.fiatCurrency;
    if (filters.userId) where.userId = filters.userId;

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const offset = (page - 1) * limit;

    // Incluir métodos de pago en todas las consultas
    const includes = [
      {
        model: this.sequelize.models.PaymentMethod,
        as: 'paymentMethods',
        through: { attributes: [] }, // No incluir datos de la tabla intermedia
        attributes: ['id', 'name', 'description', 'active']
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
          model: this.sequelize.models.PaymentMethod,
          as: 'paymentMethods',
          through: { attributes: [] },
          attributes: ['id', 'name', 'description', 'active']
        }
      ]
    });
    
    if (oferta && oferta.active) {
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
      if (oferta.created_at < twelveHoursAgo) {
        await oferta.update({ active: false });
        oferta.active = false;
      }
    }
    
    return oferta;
  }

  // Crear nueva oferta con métodos de pago
  static async createOffer(ofertaData) {
    const { type, direccionFiat, metodosPagoIds, userId, cryptoId, maxAmount, ...restData } = ofertaData;

    // Validar dirección fiat obligatoria para ventas
    if (type === 'sell' && !direccionFiat) {
      throw new Error('La dirección de pago es obligatoria para ofertas de venta');
    }

    // Validar que amount mínima sea menor que máxima
    if (ofertaData.minAmount >= ofertaData.maxAmount) {
      throw new Error('La cantidad mínima debe ser menor que la cantidad máxima');
    }

    // Validar que se proporcionen métodos de pago
    if (!metodosPagoIds || !Array.isArray(metodosPagoIds) || metodosPagoIds.length === 0) {
      throw new Error('Debe proporcionar al menos un método de pago');
    }

    // Validar que los métodos de pago existan y estén activos
    const metodosValidos = await this.sequelize.models.PaymentMethod.findAll({
      where: {
        id: { [Op.in]: metodosPagoIds },
        active: true
      }
    });

    if (metodosValidos.length !== metodosPagoIds.length) {
      throw new Error('Uno o más métodos de pago no existen o están inactivos');
    }

    // 🆕 VALIDAR FONDOS AL PUBLICAR OFERTA DE VENTA
    if (type === 'sell') {
      const { UserBalance } = require('../../models/index');
      
      // Verificar que el usuario tenga fondos suficientes para la cantidad máxima
      const balance = await UserBalance.getByUserAndCrypto(userId, cryptoId);
      
      if (!balance) {
        throw new Error('No tienes balance en esta criptomoneda');
      }

      const availableBalance = String(balance.availableBalance);
      const cantidadMaxima = String(maxAmount);

      if (money.compare(availableBalance, cantidadMaxima) < 0) {
        throw new Error(
          `Fondos insuficientes. Tienes ${availableBalance} disponible pero la oferta requiere ${cantidadMaxima}`
        );
      }
    }

    // Crear la oferta
    const nuevaOferta = await this.create({
      ...restData,
      userId,
      cryptoId,
      maxAmount,
      type,
      direccionFiat: type === 'sell' ? direccionFiat : null
    });

    // Crear las relaciones con métodos de pago
    const relacionesMetodos = metodosPagoIds.map(paymentMethodId => ({
      offerId: nuevaOferta.id,
      paymentMethodId
    }));

    await this.sequelize.models.OfferPaymentMethod.bulkCreate(relacionesMetodos);

    // Retornar oferta con métodos de pago incluidos
    return await this.getById(nuevaOferta.id);
  }

  // Actualizar oferta
  static async updateOffer(id, updateData, userId) {
    const oferta = await this.findByPk(id);
    
    if (!oferta) {
      throw new Error('Oferta no encontrada');
    }

    if (oferta.userId !== userId) {
      throw new Error('No tienes permiso para actualizar esta oferta');
    }

    const { metodosPagoIds, ...restUpdateData } = updateData;

    // Validar dirección fiat si cambia a type venta
    if (updateData.type === 'sell' && !updateData.direccionFiat && !oferta.direccionFiat) {
      throw new Error('La dirección de pago es obligatoria para ofertas de venta');
    }

    // Validar cantidades si se actualizan
    const newMin = updateData.minAmount ?? oferta.minAmount;
    const newMax = updateData.maxAmount ?? oferta.maxAmount;
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
      const metodosValidos = await this.sequelize.models.PaymentMethod.findAll({
        where: {
          id: { [Op.in]: metodosPagoIds },
          active: true
        }
      });

      if (metodosValidos.length !== metodosPagoIds.length) {
        throw new Error('Uno o más métodos de pago no existen o están inactivos');
      }

      // Eliminar métodos antiguos
      await this.sequelize.models.OfferPaymentMethod.destroy({
        where: { offerId: id }
      });

      // Crear nuevas relaciones
      const relacionesMetodos = metodosPagoIds.map(paymentMethodId => ({
        offerId: id,
        paymentMethodId
      }));

      await this.sequelize.models.OfferPaymentMethod.bulkCreate(relacionesMetodos);
    }

    // Retornar oferta actualizada con métodos de pago
    return await this.getById(id);
  }

  // Agregar métodos de pago a una oferta existente
  static async addMetodosPago(offerId, metodosPagoIds, userId) {
    const oferta = await this.findByPk(offerId);
    
    if (!oferta) {
      throw new Error('Oferta no encontrada');
    }

    if (oferta.userId !== userId) {
      throw new Error('No tienes permiso para modificar esta oferta');
    }

    if (!metodosPagoIds || !Array.isArray(metodosPagoIds) || metodosPagoIds.length === 0) {
      throw new Error('Debe proporcionar al menos un método de pago para agregar');
    }

    // Obtener métodos actuales
    const metodosActuales = await this.sequelize.models.OfferPaymentMethod.findAll({
      where: { offerId },
      attributes: ['paymentMethodId']
    });

    const metodosActualesIds = metodosActuales.map(m => m.paymentMethodId);

    // Filtrar solo métodos nuevos (que no existan ya)
    const metodosNuevos = metodosPagoIds.filter(id => !metodosActualesIds.includes(id));

    if (metodosNuevos.length === 0) {
      throw new Error('Todos los métodos de pago ya están asociados a esta oferta');
    }

    // Validar que los nuevos métodos existan y estén activos
    const metodosValidos = await this.sequelize.models.PaymentMethod.findAll({
      where: {
        id: { [Op.in]: metodosNuevos },
        active: true
      }
    });

    if (metodosValidos.length !== metodosNuevos.length) {
      throw new Error('Uno o más métodos de pago no existen o están inactivos');
    }

    // Crear nuevas relaciones
    const nuevasRelaciones = metodosNuevos.map(paymentMethodId => ({
      offerId,
      paymentMethodId
    }));

    await this.sequelize.models.OfferPaymentMethod.bulkCreate(nuevasRelaciones);

    return await this.getById(offerId);
  }

  // Eliminar métodos de pago de una oferta
  static async removeMetodosPago(offerId, metodosPagoIds, userId) {
    const oferta = await this.findByPk(offerId);
    
    if (!oferta) {
      throw new Error('Oferta no encontrada');
    }

    if (oferta.userId !== userId) {
      throw new Error('No tienes permiso para modificar esta oferta');
    }

    if (!metodosPagoIds || !Array.isArray(metodosPagoIds) || metodosPagoIds.length === 0) {
      throw new Error('Debe proporcionar al menos un método de pago para eliminar');
    }

    // Verificar cuántos métodos tiene actualmente
    const metodosActuales = await this.sequelize.models.OfferPaymentMethod.count({
      where: { offerId }
    });

    // No permitir eliminar todos los métodos
    if (metodosActuales - metodosPagoIds.length < 1) {
      throw new Error('No puede eliminar todos los métodos de pago. Debe mantener al menos uno');
    }

    // Eliminar las relaciones especificadas
    await this.sequelize.models.OfferPaymentMethod.destroy({
      where: {
        offerId,
        paymentMethodId: { [Op.in]: metodosPagoIds }
      }
    });

    return await this.getById(offerId);
  }

  // Actualizar status de oferta
  static async updateStatus(id, active) {
    const oferta = await this.findByPk(id);
    
    if (!oferta) {
      throw new Error('Oferta no encontrada');
    }

    const updateData = { active };
    if (active === true) {
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
        active: true,
        [Op.or]: [
          { additionalTerms: { [Op.like]: `%${term}%` } },
          { fiatCurrency: { [Op.like]: `%${term}%` } }
        ]
      },
      include: [
        {
          model: this.sequelize.models.PaymentMethod,
          as: 'paymentMethods',
          through: { attributes: [] },
          attributes: ['id', 'name', 'description', 'active']
        }
      ],
      limit,
      order: [['created_at', 'DESC']]
    });
  }

  // Historial de ofertas del usuario
  static async getUserOfferHistory(userId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const { rows: data, count: total } = await this.findAndCountAll({
      where: { userId },
      include: [
        {
          model: this.sequelize.models.PaymentMethod,
          as: 'paymentMethods',
          through: { attributes: [] },
          attributes: ['id', 'name', 'description', 'active']
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
  static async findCompatibleOffers(type, cryptoId, amount, fiatCurrency, paymentMethodId = null) {
    await this.deactivateExpiredOffers();

    const tipoOpuesto = type === 'buy' ? 'sell' : 'buy';

    const where = {
      active: true,
      type: tipoOpuesto,
      cryptoId,
      fiatCurrency,
      minAmount: { [Op.lte]: amount },
      maxAmount: { [Op.gte]: amount }
    };

    const includeMetodos = {
      model: this.sequelize.models.PaymentMethod,
      as: 'paymentMethods',
      through: { attributes: [] },
      attributes: ['id', 'name', 'description', 'active']
    };

    // Si se especifica un método de pago, filtrar por ese método
    if (paymentMethodId) {
      includeMetodos.where = { id: paymentMethodId };
      includeMetodos.required = true;
    }

    const ofertas = await this.findAll({
      where,
      include: [includeMetodos],
      order: [['unit_price', type === 'buy' ? 'ASC' : 'DESC']],
      limit: 20
    });

    return ofertas;
  }

  // Verificar si se puede aceptar una oferta
  static async canAcceptOffer(id, amount) {
    const oferta = await this.getById(id);

    if (!oferta) {
      return { canAccept: false, reason: 'Oferta no encontrada' };
    }

    if (!oferta.active) {
      return { canAccept: false, reason: 'Oferta inactiva o expirada' };
    }

    if (!oferta.paymentMethods || oferta.paymentMethods.length === 0) {
      return { canAccept: false, reason: 'La oferta no tiene métodos de pago disponibles' };
    }

    const cantidadNum = String(amount);

    if (money.compare(cantidadNum, String(oferta.minAmount)) < 0) {
      return { 
        canAccept: false, 
        reason: `Cantidad menor al mínimo (${oferta.minAmount})` 
      };
    }

    if (money.compare(cantidadNum, String(oferta.maxAmount)) > 0) {
      return {
        canAccept: false,
        reason: `Cantidad mayor al máximo (${oferta.maxAmount})`
      };
    }

    return { canAccept: true, oferta };
  }

  // Obtener estadísticas
  static async getStats() {
    await this.deactivateExpiredOffers();

    const [totalOfertas, ofertasActivas, ofertasCompra, ofertasVenta] = await Promise.all([
      this.count(),
      this.count({ where: { active: true } }),
      this.count({ where: { type: 'buy', active: true } }),
      this.count({ where: { type: 'sell', active: true } })
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
  P2POffer.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id'
    },
    type: {
      type: DataTypes.ENUM('buy', 'sell'),
      allowNull: false
    },
    cryptoId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'crypto_id'
    },
    minAmount: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'min_amount'
    },
    maxAmount: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'max_amount'
    },
    unitPrice: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
      field: 'unit_price'
    },
    fiatCurrency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      field: 'fiat_currency'
    },
    direccionFiat: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'direccion_fiat',
      comment: 'CBU, CVU, Alias, email PayPal, etc. Obligatorio para ventas'
    },
    additionalTerms: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'additional_terms'
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'P2POffer',
    tableName: 'p2p_offers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return P2POffer;
}

module.exports = initOfertaP2P;