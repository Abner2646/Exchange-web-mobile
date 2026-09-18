/**
 * shared/api/index.js
 *
 * Punto de entrada unificado para la capa de transporte HTTP y API.
 */

const { apiClient, createApiClient } = require('./client');
const { ApiError } = require('./errors');
const session = require('./session');
const { generateIdempotencyKey, isMoneyEndpoint } = require('./idempotency');

module.exports = {
  apiClient,
  createApiClient,
  ApiError,
  session,
  generateIdempotencyKey,
  isMoneyEndpoint,
};
