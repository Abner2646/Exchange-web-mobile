// tests/claimBtc.test.js
//
// Cubre AUDITORIA_BACKEND.md Críticos #12: PUT /balances/reclamarBTC estaba
// marcado por su propio autor como "ELIMINAR EN DEPLOY REAL" pero seguía
// vivo sin ninguna protección — y el chequeo que impedía reclamar más de
// una vez estaba comentado, así que cualquier usuario podía acumular BTC
// sin límite. Acá vive el gate de producción a nivel de controller (mockeado,
// no necesita DB). El chequeo anti-abuso end-to-end (real Postgres + ledger)
// se movió a tests/integration/claimBtc.integration.test.js con el write-flip
// (Paso B): claimFreeBtc ahora postea al ledger vía updateBalance, así que
// necesita el grafo completo de modelos (el sequelize local de 2 modelos que
// tenía este archivo ya no puede resolver el postingService).

describe('claimBtc controller — gate de producción', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = originalEnv; });

  test('en producción devuelve 404 sin siquiera tocar el modelo', async () => {
    jest.resetModules();
    process.env.NODE_ENV = 'production';

    jest.doMock('../models', () => ({
      UserBalance: { claimFreeBtc: jest.fn() },
    }));
    const { UserBalance } = require('../models');
    const { claimBtc } = require('../modules/balances/userBalance.controller');

    const req = { user: { id: 'u1' } };
    const res = {
      statusCode: null,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; },
    };

    await claimBtc(req, res);

    expect(res.statusCode).toBe(404);
    expect(UserBalance.claimFreeBtc).not.toHaveBeenCalled();
  });
});
