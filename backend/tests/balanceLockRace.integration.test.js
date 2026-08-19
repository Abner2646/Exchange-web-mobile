// tests/balanceLockRace.integration.test.js
//
// Cubre AUDITORIA_BACKEND.md Críticos #5: BalanceUser.blockBalance hacía
// findOne() + save() sin transacción ni lock — dos requests casi
// simultáneas podían leer el mismo balance, pasar la validación las dos, y
// bloquear en conjunto más de lo que el usuario realmente tenía.
//
// Esto es un test de integración de verdad (Postgres real, dos conexiones
// concurrentes) a propósito: un mock no puede probar que un SELECT ... FOR
// UPDATE serializa dos transacciones — hace falta una base de datos real
// para eso. Es el mismo tipo de infraestructura (DB de test en Docker) que
// la Fase 2 del roadmap va a formalizar; acá es un adelanto puntual para
// este fix específico.
//
// Se salta entero (con aviso) si no hay Postgres accesible en TEST_DB_HOST/
// TEST_DB_PORT (o los defaults de abajo, pensados para levantar rápido):
//   docker run -d -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test -p 55432:5432 postgres:15-alpine
//
// El chequeo de disponibilidad es síncrono (execSync + pg_isready) porque
// Jest arma la lista de tests/skips ANTES de correr beforeAll — decidir
// test vs test.skip adentro de un beforeAll asíncrono no funciona, se
// evalúa demasiado tarde.

const { execSync } = require('child_process');

const TEST_DB_HOST = process.env.TEST_DB_HOST || 'localhost';
const TEST_DB_PORT = process.env.TEST_DB_PORT || '55432';
const TEST_DB_URL =
  process.env.TEST_DB_URL || `postgres://postgres:test@${TEST_DB_HOST}:${TEST_DB_PORT}/test`;

let dbAvailable = false;
try {
  execSync(`pg_isready -h ${TEST_DB_HOST} -p ${TEST_DB_PORT}`, { stdio: 'ignore' });
  dbAvailable = true;
} catch {
  dbAvailable = false;
}

if (!dbAvailable) {
  console.warn(
    `\n⚠️  balanceLockRace.integration.test.js: sin Postgres en ${TEST_DB_HOST}:${TEST_DB_PORT}, se saltea. ` +
    `Levantalo con: docker run -d -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test -p 55432:5432 postgres:15-alpine\n`
  );
}

const describeIfDb = dbAvailable ? describe : describe.skip;

describeIfDb('BalanceUser.blockBalance bajo concurrencia (Postgres real)', () => {
  const { Sequelize } = require('sequelize');
  const createBalanceUserModel = require('../models/balanceUsuario.model');

  let sequelize;
  let BalanceUser;

  const userId = '11111111-1111-1111-1111-111111111111';
  const criptomonedaId = '22222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    sequelize = new Sequelize(TEST_DB_URL, { logging: false });
    await sequelize.authenticate();
    BalanceUser = createBalanceUserModel(sequelize);
    await BalanceUser.sync({ force: true });
  });

  afterAll(async () => {
    if (sequelize) await sequelize.close();
  });

  beforeEach(async () => {
    await BalanceUser.destroy({ where: {}, truncate: true });
    await BalanceUser.create({
      userId,
      criptomonedaId,
      balanceDisponible: 100,
      balanceBloqueado: 0,
    });
  });

  test(
    'dos bloqueos concurrentes de 80 sobre un balance de 100: solo uno tiene que pasar',
    async () => {
      const resultados = await Promise.allSettled([
        BalanceUser.blockBalance(userId, criptomonedaId, 80),
        BalanceUser.blockBalance(userId, criptomonedaId, 80),
      ]);

      const exitosos = resultados.filter((r) => r.status === 'fulfilled');
      const fallidos = resultados.filter((r) => r.status === 'rejected');

      // Antes del fix: acá podían ser 2 exitosos (double-spend real).
      expect(exitosos).toHaveLength(1);
      expect(fallidos).toHaveLength(1);
      expect(fallidos[0].reason.message).toMatch(/insuficiente/i);

      const balanceFinal = await BalanceUser.findOne({ where: { userId, criptomonedaId } });
      expect(parseFloat(balanceFinal.balanceDisponible)).toBe(20);
      expect(parseFloat(balanceFinal.balanceBloqueado)).toBe(80);
    },
    15000
  );

  test(
    'diez bloqueos concurrentes de 15 sobre un balance de 100: como mucho 6 pasan, nunca queda negativo',
    async () => {
      const resultados = await Promise.allSettled(
        Array.from({ length: 10 }, () => BalanceUser.blockBalance(userId, criptomonedaId, 15))
      );

      const exitosos = resultados.filter((r) => r.status === 'fulfilled');
      expect(exitosos.length).toBeLessThanOrEqual(6); // 6 * 15 = 90 <= 100 < 7 * 15 = 105

      const balanceFinal = await BalanceUser.findOne({ where: { userId, criptomonedaId } });
      expect(parseFloat(balanceFinal.balanceDisponible)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(balanceFinal.balanceBloqueado)).toBe(exitosos.length * 15);
    },
    15000
  );
});
