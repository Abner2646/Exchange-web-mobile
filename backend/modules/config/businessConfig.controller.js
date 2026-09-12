// controllers/configuracionNegocio.controller.js
//
// Radar #13 — CRUD de admin sobre la config de NEGOCIO persistida. Las rutas van
// guardadas por isAdmin + requireOperatorMFA (editar política de negocio es una
// acción privilegiada de operador, Fase 4.9). Escribe vía el servicio para que la
// cache se invalide. Envelope canónico { error: { code, message } }.
const { BusinessConfig } = require('../../models');
const businessConfig = require('./businessConfig');
const AppError = require('../../utils/AppError');
const errorCodes = require('../../utils/errorCodes');

const TIPOS = ['string', 'number', 'boolean', 'json'];

// GET /config — listar toda la config de negocio
const getConfiguraciones = async (req, res) => {
  const filtro = {};
  if (req.query.category) filtro.category = req.query.category;
  const configs = await BusinessConfig.findAll({ where: filtro, order: [['key', 'ASC']] });
  res.json({ data: configs });
};

// GET /config/:key — una key
const getConfiguracion = async (req, res) => {
  const config = await BusinessConfig.findByPk(req.params.key);
  if (!config) {
    throw new AppError(404, errorCodes.CONFIG_NOT_FOUND, 'Clave de configuración no encontrada');
  }
  res.json({ data: config });
};

// PUT /config/:key — crear/actualizar (upsert vía el servicio → invalida cache)
const upsertConfiguracion = async (req, res) => {
  const { key } = req.params;
  const { value, type = 'string', category = null, description = null } = req.body;

  if (value === undefined || value === null || String(value).trim() === '') {
    throw new AppError(400, errorCodes.CONFIG_INVALID_INPUT, 'valor es requerido');
  }
  if (!TIPOS.includes(type)) {
    throw new AppError(400, errorCodes.CONFIG_INVALID_INPUT, `type inválido (usá: ${TIPOS.join(', ')})`);
  }

  await businessConfig.set(key, value, { type, category, description });
  const config = await BusinessConfig.findByPk(key);
  res.json({ message: 'Configuración guardada', data: config });
};

module.exports = { getConfiguraciones, getConfiguracion, upsertConfiguracion };
