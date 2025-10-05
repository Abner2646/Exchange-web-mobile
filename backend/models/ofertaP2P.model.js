// Importaciones
const initOfertaP2P = require('./entities/ofertaP2P.entity');
const { Op } = require('sequelize');

function createOfertaP2PModel(sequelize) {
  const OfertaP2P = initOfertaP2P(sequelize);

  // Métodos de creación y validación
  OfertaP2P.createOffer = async (data) => {
    const { 
      usuarioId, 
      tipo, 
      criptomonedaId, 
      cantidadMin, 
      cantidadMax, 
      precioUnitario, 
      monedaFiat,
      condicionesAdicionales,
      metodosPagoIds = []
    } = data;

    // Validaciones
    if (parseFloat(cantidadMin) >= parseFloat(cantidadMax)) {
      throw new Error('La cantidad mínima debe ser menor que la cantidad máxima');
    }

    if (parseFloat(precioUnitario) <= 0) {
      throw new Error('El precio unitario debe ser mayor a 0');
    }

    // ✅ Transacción gestionada automáticamente
    const oferta = await sequelize.transaction(async (t) => {
      const nuevaOferta = await OfertaP2P.create({
        usuarioId,
        tipo,
        criptomonedaId,
        cantidadMin,
        cantidadMax,
        precioUnitario,
        monedaFiat,
        condicionesAdicionales,
        activa: true
      }, { transaction: t });

      // Asociar métodos de pago
      if (metodosPagoIds.length > 0) {
        await nuevaOferta.setMetodosPago(metodosPagoIds, { transaction: t });
      }

      return nuevaOferta;
    });

    // Cargar con relaciones
    return await OfertaP2P.getById(oferta.id);
  };

  // Métodos de consulta
  OfertaP2P.getById = async (id) => {
    return await OfertaP2P.findByPk(id, {
      include: [
        {
          association: 'usuario',
          attributes: ['id', 'username', 'email', /*'reputacion'*/] // Todavía no está desarrollada la reputación
        },
        {
          association: 'criptomoneda',
          attributes: ['id', 'nombre', 'symbol']
        },
        {
          association: 'metodosPago',
          attributes: ['id', 'nombre', /*'tipo'*/]
        }
        //{
        //  association: 'transacciones', // ⚠️ Esta está comentada en tus relaciones
        //  attributes: ['id', 'estado', 'cantidadCrypto', 'montoFiat', 'created_at']
        //}
      ]
    });
  };

  OfertaP2P.getAll = async (filters = {}) => {
    const {
      tipo,
      criptomonedaId,
      monedaFiat,
      activa,
      usuarioId,
      cantidadMin,
      cantidadMax,
      precioMin,
      precioMax,
      page = 1,
      limit = 20,
      orderBy = 'created_at',
      orderDirection = 'DESC'
    } = filters;

    const where = {};
    const offset = (page - 1) * limit;

    // Filtros básicos
    if (tipo) where.tipo = tipo;
    if (criptomonedaId) where.criptomonedaId = criptomonedaId;
    if (monedaFiat) where.monedaFiat = monedaFiat;
    if (activa !== undefined) where.activa = activa;
    if (usuarioId) where.usuarioId = usuarioId;

    // Filtros de rango
    if (cantidadMin || cantidadMax) {
      where.cantidadMax = {};
      if (cantidadMin) where.cantidadMax[Op.gte] = cantidadMin;
      if (cantidadMax) where.cantidadMin = { [Op.lte]: cantidadMax };
    }

    if (precioMin || precioMax) {
      where.precioUnitario = {};
      if (precioMin) where.precioUnitario[Op.gte] = precioMin;
      if (precioMax) where.precioUnitario[Op.lte] = precioMax;
    }

    const { count, rows } = await OfertaP2P.findAndCountAll({
      where,
      include: [
        {
          association: 'usuario',
          attributes: ['id', 'username'/*, 'reputacion'*/]
        },
        {
          association: 'criptomoneda',
          attributes: ['id', 'nombre', 'symbol']
        },
        {
          association: 'metodosPago',
          attributes: ['id', 'nombre'/*, 'tipo'*/]
        }
      ],
      order: [[orderBy, orderDirection]],
      limit: parseInt(limit),
      offset,
      distinct: true
    });

    return {
      ofertas: rows,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    };
  };

  OfertaP2P.search = async (term, limit = 10) => {
    return await OfertaP2P.findAll({
      where: {
        [Op.or]: [
          { condicionesAdicionales: { [Op.iLike]: `%${term}%` } },
          { monedaFiat: { [Op.iLike]: `%${term}%` } }
        ],
        activa: true
      },
      include: [
        {
          association: 'usuario',
          attributes: ['id', 'username']
        },
        {
          association: 'criptomoneda',
          attributes: ['id', 'nombre', 'symbol']
        }
      ],
      limit,
      order: [['created_at', 'DESC']]
    });
  };

  // Métodos de negocio específicos
  OfertaP2P.findCompatibleOffers = async (tipo, criptomonedaId, cantidad, monedaFiat, metodoPagoId = null) => {
    const tipoOpuesto = tipo === 'compra' ? 'venta' : 'compra';
    const where = {
      tipo: tipoOpuesto,
      criptomonedaId,
      monedaFiat,
      activa: true,
      cantidadMin: { [Op.lte]: cantidad },
      cantidadMax: { [Op.gte]: cantidad }
    };

    const include = [
      {
        association: 'usuario',
        attributes: ['id', 'username'/*, 'reputacion'*/]
      },
      {
        association: 'criptomoneda',
        attributes: ['id', 'nombre', 'symbol']
      },
      {
        association: 'metodosPago',
        attributes: ['id', 'nombre', /*'tipo'*/],
        where: metodoPagoId ? { id: metodoPagoId } : undefined,
        required: metodoPagoId ? true : false
      }
    ];

    return await OfertaP2P.findAll({
      where,
      include,
      order: [
        [tipo === 'compra' ? 'precioUnitario' : 'precioUnitario', tipo === 'compra' ? 'ASC' : 'DESC']
      ],
      limit: 50
    });
  };

  // Métodos administrativos
  OfertaP2P.updateStatus = async (id, newStatus) => {
    const oferta = await OfertaP2P.findByPk(id);
    if (!oferta) {
      throw new Error('Oferta no encontrada');
    }

    await oferta.update({ activa: newStatus });
    return await OfertaP2P.getById(id);
  };

  OfertaP2P.updateOffer = async (id, data, usuarioId = null) => {
    const oferta = await OfertaP2P.findByPk(id);
    if (!oferta) {
      throw new Error('Oferta no encontrada');
    }

    // Verificar que el usuario sea el propietario (si se proporciona usuarioId)
    if (usuarioId && oferta.usuarioId !== usuarioId) {
      throw new Error('No tienes permiso para modificar esta oferta');
    }

    // Validaciones
    if (data.cantidadMin && data.cantidadMax && 
        parseFloat(data.cantidadMin) >= parseFloat(data.cantidadMax)) {
      throw new Error('La cantidad mínima debe ser menor que la cantidad máxima');
    }

    if (data.precioUnitario && parseFloat(data.precioUnitario) <= 0) {
      throw new Error('El precio unitario debe ser mayor a 0');
    }

    const transaction = await sequelize.transaction();
    
    try {
      await oferta.update(data, { transaction });
      
      // Actualizar métodos de pago si se proporcionaron
      if (data.metodosPagoIds) {
        await oferta.setMetodosPago(data.metodosPagoIds, { transaction });
      }

      await transaction.commit();
      return await OfertaP2P.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  };

  // Métodos relacionados con transacciones
  OfertaP2P.canAcceptOffer = async (id, cantidad) => {
    const oferta = await OfertaP2P.findByPk(id);
    if (!oferta) return { canAccept: false, reason: 'Oferta no encontrada' };
    if (!oferta.activa) return { canAccept: false, reason: 'Oferta inactiva' };
    
    const cantidadNum = parseFloat(cantidad);
    if (cantidadNum < parseFloat(oferta.cantidadMin) || 
        cantidadNum > parseFloat(oferta.cantidadMax)) {
      return { 
        canAccept: false, 
        reason: `La cantidad debe estar entre ${oferta.cantidadMin} y ${oferta.cantidadMax}` 
      };
    }

    return { canAccept: true };
  };

  OfertaP2P.getStats = async () => {
    const stats = await OfertaP2P.findAll({
      attributes: [
        'tipo',
        'monedaFiat',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN activa = true THEN 1 END')), 'activas'],
        [sequelize.fn('AVG', sequelize.col('precioUnitario')), 'precioPromedio']
      ],
      group: ['tipo', 'monedaFiat'],
      raw: true
    });

    return stats;
  };

  OfertaP2P.getUserOfferHistory = async (usuarioId, page = 1, limit = 20) => {
    const offset = (page - 1) * limit;
    
    const { count, rows } = await OfertaP2P.findAndCountAll({
      where: { usuarioId },
      include: [
        {
          association: 'criptomoneda',
          attributes: ['id', 'nombre', 'simbolo']
        },
        {
          association: 'transacciones',
          attributes: ['id', 'estado', 'cantidadCrypto', 'montoFiat', 'created_at']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
      distinct: true
    });

    return {
      ofertas: rows,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    };
  };

  return OfertaP2P;
}

module.exports = createOfertaP2PModel;