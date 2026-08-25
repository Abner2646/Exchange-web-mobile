// backend/tests/ofertaP2PRouteShadowing.test.js
//
// Fase 1 — barrera de regresión de routing. Se había anotado como sospecha que
// GET /me/ofertas quedaba shadoweado por el GET /:id declarado antes. Se
// investigó: NO lo está — /:id matchea un único segmento y /me/ofertas tiene
// dos, así que Express nunca lo captura con /:id (verificado empíricamente).
// Este test fija esa conclusión: si alguien reordena las rutas o cambia el
// endpoint a un único segmento (/me), el shadow se volvería real y esto lo
// atraparía.

const request = require('supertest');
const express = require('express');

// Middleware → pass-through (no auth real en el test).
jest.mock('../middleware/authMiddleware.js', () => ({
  authenticateToken: (req, _res, next) => next(),
  requireEmailVerified: (req, _res, next) => next(),
}));
jest.mock('../middleware/adminMiddleware.js', () => ({
  isAdmin: (req, _res, next) => next(),
}));

// Controller → cada método reporta su nombre, para saber cuál atrapó la ruta.
jest.mock('../controllers/ofertaP2P.controller.js', () => {
  const names = [
    'findCompatibleOffers', 'searchOfertas', 'getOfertasByTipo', 'getOfertasByCrypto',
    'getOfertas', 'getOfertasActivas', 'getOfertaById', 'createOferta', 'updateOferta',
    'deleteOferta', 'getMyOfertas', 'toggleMyOferta', 'checkOfferAcceptability',
    'addMetodosPago', 'removeMetodosPago', 'getOfertasStats', 'updateOfertaStatus',
  ];
  const mod = {};
  for (const name of names) {
    mod[name] = (req, res) => res.json({ handler: name, params: req.params });
  }
  return mod;
});

const router = require('../routes/ofertaP2P.routes.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/ofertas', router);
  return app;
}

describe('ofertaP2P routing — /me/ofertas no está shadoweado por /:id', () => {
  test('GET /ofertas/me/ofertas → getMyOfertas', async () => {
    const res = await request(buildApp()).get('/ofertas/me/ofertas');
    expect(res.status).toBe(200);
    expect(res.body.handler).toBe('getMyOfertas');
  });

  test('GET /ofertas/:id (single segment) sigue yendo a getOfertaById', async () => {
    const res = await request(buildApp()).get('/ofertas/some-uuid');
    expect(res.status).toBe(200);
    expect(res.body.handler).toBe('getOfertaById');
    expect(res.body.params.id).toBe('some-uuid');
  });
});
