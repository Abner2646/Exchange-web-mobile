// services/config/businessConfig.js
//
// Radar #13 — lectura/escritura de la config de NEGOCIO persistida
// (`business_config`). Único punto de acceso, para que migrar un parámetro
// hardcodeado/env a config sea `businessConfig.getNumber('key', <default previo>)`
// — no-breaking: sin fila sembrada, devuelve el default y se comporta igual.
//
// Cache en memoria de claves PRESENTES (la config de negocio cambia poco y se lee
// seguido). Las claves ausentes no se cachean, así sembrar/editar después se ve
// sin reiniciar. `set` invalida la key. (Multi-instancia: una invalidación
// distribuida es follow-up de Fase 5/6; hoy es monolito.)
//
// require lazy de models: este módulo puede cargarse desde código que a su vez
// carga models/index.js.
const cache = new Map();

async function get(key, fallback = null) {
  if (cache.has(key)) return cache.get(key);
  const { BusinessConfig } = require('../../models');
  const row = await BusinessConfig.findByPk(key);
  if (!row) return fallback;
  cache.set(key, row.value);
  return row.value;
}

async function getNumber(key, fallback = null) {
  const v = await get(key, null);
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
}

async function getBoolean(key, fallback = false) {
  const v = await get(key, null);
  if (v === null || v === undefined) return fallback;
  return v === 'true' || v === '1';
}

async function set(key, value, meta = {}) {
  const { BusinessConfig } = require('../../models');
  const [row] = await BusinessConfig.upsert({ key, value: String(value), ...meta });
  cache.delete(key);
  return row;
}

function clearCache() { cache.clear(); }

module.exports = { get, getNumber, getBoolean, set, clearCache };
