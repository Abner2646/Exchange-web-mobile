// controllers/configuracionNegocio.controller.js
//
// Radar #13 — CRUD de admin sobre la config de NEGOCIO persistida. Las rutas van
// guardadas por isAdmin + requireOperatorMFA (editar política de negocio es una
// acción privilegiada de operador, Fase 4.9). Escribe vía el servicio para que la
// cache se invalide. Envelope canónico { error: { code, message } }.
const { ConfiguracionNegocio } = require('../models');
const businessConfig = require('../services/config/businessConfig');
const AppError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');

const TIPOS = ['string', 'number', 'boolean', 'json'];

// GET /config — listar toda la config de negocio
const getConfiguraciones = async (req, res) => {
  const filtro = {};
  if (req.query.categoria) filtro.categoria = req.query.categoria;
  const configs = await ConfiguracionNegocio.findAll({ where: filtro, order: [['clave', 'ASC']] });
  res.json({ data: configs });
};

// GET /config/:clave — una clave
const getConfiguracion = async (req, res) => {
  const config = await ConfiguracionNegocio.findByPk(req.params.clave);
  if (!config) {
    throw new AppError(404, errorCodes.CONFIG_NOT_FOUND, 'Clave de configuración no encontrada');
  }
  res.json({ data: config });
};

// PUT /config/:clave — crear/actualizar (upsert vía el servicio → invalida cache)
const upsertConfiguracion = async (req, res) => {
  const { clave } = req.params;
  const { valor, tipo = 'string', categoria = null, descripcion = null } = req.body;

  if (valor === undefined || valor === null || String(valor).trim() === '') {
    throw new AppError(400, errorCodes.CONFIG_INVALID_INPUT, 'valor es requerido');
  }
  if (!TIPOS.includes(tipo)) {
    throw new AppError(400, errorCodes.CONFIG_INVALID_INPUT, `tipo inválido (usá: ${TIPOS.join(', ')})`);
  }

  await businessConfig.set(clave, valor, { tipo, categoria, descripcion });
  const config = await ConfiguracionNegocio.findByPk(clave);
  res.json({ message: 'Configuración guardada', data: config });
};

module.exports = { getConfiguraciones, getConfiguracion, upsertConfiguracion };
