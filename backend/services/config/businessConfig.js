// services/config/businessConfig.js
//
// Radar #13 — lectura/escritura de la config de NEGOCIO persistida
// (`configuracion_negocio`). Único punto de acceso, para que migrar un parámetro
// hardcodeado/env a config sea `businessConfig.getNumber('clave', <default previo>)`
// — no-breaking: sin fila sembrada, devuelve el default y se comporta igual.
//
// Cache en memoria de claves PRESENTES (la config de negocio cambia poco y se lee
// seguido). Las claves ausentes no se cachean, así sembrar/editar después se ve
// sin reiniciar. `set` invalida la clave. (Multi-instancia: una invalidación
// distribuida es follow-up de Fase 5/6; hoy es monolito.)
//
// require lazy de models: este módulo puede cargarse desde código que a su vez
// carga models/index.js.
const cache = new Map();

async function get(clave, fallback = null) {
  if (cache.has(clave)) return cache.get(clave);
  const { ConfiguracionNegocio } = require('../../models');
  const row = await ConfiguracionNegocio.findByPk(clave);
  if (!row) return fallback;
  cache.set(clave, row.valor);
  return row.valor;
}

async function getNumber(clave, fallback = null) {
  const v = await get(clave, null);
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
}

async function getBoolean(clave, fallback = false) {
  const v = await get(clave, null);
  if (v === null || v === undefined) return fallback;
  return v === 'true' || v === '1';
}

async function set(clave, valor, meta = {}) {
  const { ConfiguracionNegocio } = require('../../models');
  const [row] = await ConfiguracionNegocio.upsert({ clave, valor: String(valor), ...meta });
  cache.delete(clave);
  return row;
}

function clearCache() { cache.clear(); }

module.exports = { get, getNumber, getBoolean, set, clearCache };
