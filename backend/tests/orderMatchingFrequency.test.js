// tests/orderMatchingFrequency.test.js
//
// Cubre AUDITORIA_BACKEND.md Altos #2: matchFrequency estaba en 10000
// (10 segundos) pese a que el propio comentario decía "100ms = 10 veces
// por segundo" — el matching corría 100 veces más lento que lo
// documentado/intencionado.

jest.mock('../models', () => ({ Order: {}, TradingPair: {} }));
jest.mock('../services/trading/orderBook.service', () => ({}));

const orderMatchingJob = require('../jobs/orderMatching.job');

test('matchFrequency es 100ms, no 10s', () => {
  expect(orderMatchingJob.matchFrequency).toBe(100);
});
