// tests/valoracionesReactivation.test.js
//
// Cubre AUDITORIA_BACKEND.md Altos #11: la ruta /valoracion estaba
// comentada pese a que el sistema estaba completo. Al reactivarla
// aparecieron bugs reales que la auditoría original solo había detectado
// parcialmente:
// - getTopRatedUsers y getUsersRatingSummary (controller) usaban Op y
//   sequelize sin importarlos — ReferenceError garantizado.
// - Todo el resto de valoracion.model.js (9 lugares, no solo esos 2)
//   pedía las columnas 'nombre' y 'reputacion' de Usuario, que no
//   existen — el campo real es 'username' y 'reputacionPromedio'. Esto
//   es un error a nivel SQL (columna inexistente), no solo JS.

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
    `\n⚠️  valoracionesReactivation.test.js: sin Postgres en ${TEST_DB_HOST}:${TEST_DB_PORT}, se saltea la parte de integración. ` +
    `Levantalo con: docker run -d -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test -p 55432:5432 postgres:15-alpine\n`
  );
} else {
  process.env.NODE_ENV = 'development';
  process.env.DB_HOST = TEST_DB_HOST;
  process.env.DB_PORT = TEST_DB_PORT;
  process.env.DB_USER = process.env.DB_USER || 'postgres';
  process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test';
  process.env.DB_NAME = process.env.DB_NAME || 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
}

const describeIfDb = dbAvailable ? describe : describe.skip;

describeIfDb('Valoracion.getById — la query real contra Postgres (no un mock)', () => {
  let sequelize, Valoracion;

  beforeAll(async () => {
    ({ sequelize, Valoracion } = require('../models'));
    sequelize.options.logging = false;
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('no revienta con "column usuario.nombre does not exist" (aunque no haya ninguna fila)', async () => {
    // No hace falta que exista la valoración: Sequelize igual compila y
    // ejecuta el SELECT con los JOIN/attributes de las asociaciones
    // 'evaluador'/'evaluado' (antes pedían 'nombre'/'reputacion', columnas
    // que no existen) — eso es lo que falla a nivel SQL, no la ausencia
    // de filas. findByPk con un id que no matchea devuelve null sin
    // tirar excepción, PERO solo si la query en sí es válida.
    const result = await Valoracion.getById('99999999-9999-4999-8999-999999999999');
    expect(result).toBeNull();
  });
});
