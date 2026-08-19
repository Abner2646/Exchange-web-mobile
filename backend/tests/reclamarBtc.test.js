// tests/reclamarBtc.test.js
//
// Cubre AUDITORIA_BACKEND.md Críticos #12: PUT /balances/reclamarBTC estaba
// marcado por su propio autor como "ELIMINAR EN DEPLOY REAL" pero seguía
// vivo sin ninguna protección — y el chequeo que impedía reclamar más de
// una vez estaba comentado, así que cualquier usuario podía acumular BTC
// sin límite. Dos fixes, dos tests: el chequeo anti-abuso (real Postgres,
// porque es lógica de modelo con lecturas encadenadas) y el gate de
// producción a nivel de controller (mockeado, no necesita DB).

const { execSync } = require('child_process');

const TEST_DB_HOST = process.env.TEST_DB_HOST || 'localhost';
const TEST_DB_PORT = process.env.TEST_DB_PORT || '55432';

let dbAvailable = false;
try {
  execSync(`pg_isready -h ${TEST_DB_HOST} -p ${TEST_DB_PORT}`, { stdio: 'ignore' });
  dbAvailable = true;
} catch {
  dbAvailable = false;
}

if (!dbAvailable) {
  console.warn(
    `\n⚠️  reclamarBtc.test.js: sin Postgres en ${TEST_DB_HOST}:${TEST_DB_PORT}, se saltea la parte de integración. ` +
    `Levantalo con: docker run -d -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test -p 55432:5432 postgres:15-alpine\n`
  );
}

const describeIfDb = dbAvailable ? describe : describe.skip;

describeIfDb('BalanceUser.reclamarBtcGratis (Postgres real)', () => {
  let sequelize, BalanceUser, Criptomoneda;

  beforeAll(async () => {
    const { Sequelize } = require('sequelize');
    sequelize = new Sequelize(
      `postgres://postgres:test@${TEST_DB_HOST}:${TEST_DB_PORT}/test`,
      { logging: false }
    );
    Criptomoneda = require('../models/criptomoneda.model')(sequelize);
    BalanceUser = require('../models/balanceUsuario.model')(sequelize);
    await sequelize.sync({ force: true });
    await Criptomoneda.create({ symbol: 'BTC', nombre: 'Bitcoin', red: 'bitcoin', decimales: 8 });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('un usuario sin balance previo sí puede reclamar', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const resultado = await BalanceUser.reclamarBtcGratis(userId);
    expect(resultado.success).toBe(true);
    expect(parseFloat(resultado.balance.balanceDisponible)).toBe(1);
  });

  test('un usuario que ya reclamó (o ya tiene saldo) no puede reclamar de nuevo', async () => {
    const userId = '22222222-2222-2222-2222-222222222222';
    await BalanceUser.reclamarBtcGratis(userId); // primer reclamo, válido

    await expect(BalanceUser.reclamarBtcGratis(userId)).rejects.toThrow(/solo para usuarios nuevos/);
  });
});

describe('reclamarBtc controller — gate de producción', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = originalEnv; });

  test('en producción devuelve 404 sin siquiera tocar el modelo', async () => {
    jest.resetModules();
    process.env.NODE_ENV = 'production';

    jest.doMock('../models', () => ({
      BalanceUsuario: { reclamarBtcGratis: jest.fn() },
    }));
    const { BalanceUsuario } = require('../models');
    const { reclamarBtc } = require('../controllers/balanceUsuario.controller');

    const req = { user: { id: 'u1' } };
    const res = {
      statusCode: null,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; },
    };

    await reclamarBtc(req, res);

    expect(res.statusCode).toBe(404);
    expect(BalanceUsuario.reclamarBtcGratis).not.toHaveBeenCalled();
  });
});
