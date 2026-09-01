// tests/balanceUsuarioLazyRequire.test.js
//
// Cubre AUDITORIA_BACKEND.md Altos #10: transaccionBlockchain.model.js
// re-inicializaba la entidad BalanceUsuario cruda a nivel de módulo en vez
// de usar el modelo que models/index.js ya inicializó y asoció. Se
// reemplazó por un require('./index') lazy, adentro de cada función que
// lo necesita (para evitar el require circular a nivel de módulo).
//
// Este test prueba que ese require lazy resuelve de verdad, en runtime,
// al modelo real — no alcanza con "no explota al cargar", hay que probar
// que _acreditarDeposito efectivamente escribe en la tabla balances_users
// a través del grafo completo de asociaciones de models/index.js.
//
// Postgres real a propósito: es justamente el orden de carga / resolución
// de módulos lo que se está probando.

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
    `\n⚠️  balanceUsuarioLazyRequire.test.js: sin Postgres en ${TEST_DB_HOST}:${TEST_DB_PORT}, se saltea. ` +
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

describeIfDb('transaccionBlockchain.model.js: require lazy de BalanceUsuario', () => {
  let sequelize, Usuario, Criptomoneda, BalanceUsuario, TransaccionBlockchain;

  beforeAll(async () => {
    ({ sequelize, Usuario, Criptomoneda, BalanceUsuario, TransaccionBlockchain } = require('../models'));
    sequelize.options.logging = false;
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('el archivo ya no importa initBalanceUsuario a nivel de módulo', () => {
    const fs = require('fs');
    const source = fs.readFileSync(require.resolve('../models/transaccionBlockchain.model'), 'utf8');
    expect(source).not.toMatch(/require\(['"]\.\/entities\/balanceUsuario\.entity['"]\)/);
  });

  test('_acreditarDeposito acredita de verdad en el ledger vía el modelo real de models/index.js', async () => {
    const user = await Usuario.create({ email: 'lazy@test.com', username: 'lazy_user', passwordHash: 'x', rol: 'normal' });
    const cripto = await Criptomoneda.create({ symbol: 'ETH', nombre: 'Ethereum', red: 'ethereum', decimales: 18 });

    // Write-flip (Paso B): _acreditarDeposito delega en updateBalance, que postea
    // al ledger. Se prueba que el require lazy resuelve el modelo real y que la
    // acreditacion llega a la proyeccion Funding del ledger.
    await TransaccionBlockchain._acreditarDeposito(
      { id: '99999999-9999-4999-8999-999999999999', userId: user.id, criptomonedaId: cripto.id, cantidad: '1.50000000', estado: 'pendiente' },
      null
    );

    const posting = require('../services/ledger/postingService');
    const { PROPOSITOS } = require('../services/ledger/ledgerAccounts');
    const disponible = await posting.getSaldoCuenta({ ownerId: user.id, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id });
    expect(disponible).toBe('1.50000000');
  });
});
