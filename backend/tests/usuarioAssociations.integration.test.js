// tests/usuarioAssociations.integration.test.js
//
// Cubre AUDITORIA_BACKEND.md Críticos #9: las asociaciones Usuario↔BalanceUsuario,
// Usuario↔DireccionDeposito y Usuario↔TransaccionBlockchain se declaraban con
// foreignKey: 'usuarioId', pero la columna real en las tres tablas es user_id
// (userId en el modelo). Sequelize sintetizaba una columna fantasma nunca
// poblada, así que Usuario.findByPk(id, { include: [...] }) devolvía
// silenciosamente un array vacío para esas tres relaciones — sin tirar
// ningún error, lo cual es justo lo que lo hace peligroso.
//
// Es un test de integración de verdad (Postgres real) a propósito: el bug
// es específicamente sobre cómo Sequelize arma el JOIN contra columnas
// reales — no es algo que un mock pueda demostrar.
//
// Se salta (con aviso) si no hay Postgres en TEST_DB_HOST/TEST_DB_PORT.
// Levantar con:
//   docker run -d -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test -p 55432:5432 postgres:15-alpine

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
    `\n⚠️  usuarioAssociations.integration.test.js: sin Postgres en ${TEST_DB_HOST}:${TEST_DB_PORT}, se saltea. ` +
    `Levantalo con: docker run -d -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test -p 55432:5432 postgres:15-alpine\n`
  );
} else {
  // Estas env vars las lee config/database.js al requerir '../models' más
  // abajo. Forzamos NODE_ENV=development porque el bloque "test" de
  // config/database.js le agrega el sufijo _test al nombre de la base, y acá
  // queremos conectar tal cual al Postgres descartable de arriba.
  process.env.NODE_ENV = 'development';
  process.env.DB_HOST = TEST_DB_HOST;
  process.env.DB_PORT = TEST_DB_PORT;
  process.env.DB_USER = process.env.DB_USER || 'postgres';
  process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test';
  process.env.DB_NAME = process.env.DB_NAME || 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
}

const describeIfDb = dbAvailable ? describe : describe.skip;

describeIfDb('Asociaciones Usuario -> balances / direccionesDeposito / transaccionesBlockchain', () => {
  let sequelize, Usuario, BalanceUsuario, Criptomoneda, DireccionDeposito, TransaccionBlockchain, WalletMaestra;

  beforeAll(async () => {
    ({ sequelize, Usuario, BalanceUsuario, Criptomoneda, DireccionDeposito, TransaccionBlockchain, WalletMaestra } = require('../models'));
    sequelize.options.logging = false;
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('Usuario.include(\'balances\') devuelve el balance real, no un array vacío', async () => {
    const user = await Usuario.create({ email: 'balances@test.com', username: 'balances_user', passwordHash: 'x', rol: 'normal' });
    const cripto = await Criptomoneda.create({ symbol: 'BTC', nombre: 'Bitcoin', red: 'bitcoin', decimales: 8 });
    await BalanceUsuario.create({ userId: user.id, criptomonedaId: cripto.id, balanceDisponible: 5, balanceBloqueado: 0 });

    const withBalances = await Usuario.findByPk(user.id, { include: [{ association: 'balances' }] });

    expect(withBalances.balances).toHaveLength(1);
    expect(parseFloat(withBalances.balances[0].balanceDisponible)).toBe(5);
  });

  test('Usuario.include(\'direccionesDeposito\') devuelve la dirección real', async () => {
    const user = await Usuario.create({ email: 'direcciones@test.com', username: 'direcciones_user', passwordHash: 'x', rol: 'normal' });
    const cripto = await Criptomoneda.create({ symbol: 'ETH', nombre: 'Ethereum', red: 'ethereum', decimales: 18 });
    const wallet = await WalletMaestra.create({
      criptomonedaId: cripto.id, nombre: 'ETH master', red: 'ethereum', symbol: 'ETH',
      direccionPublica: '0xmaster', xpub: 'ethxpubtest123',
    });
    await DireccionDeposito.create({
      userId: user.id, criptomonedaId: cripto.id, walletMaestraId: wallet.id,
      direccion: '0xabc', derivationIndex: 0, derivationPath: "m/44'/60'/0'/0/0",
    });

    const withDirs = await Usuario.findByPk(user.id, { include: [{ association: 'direccionesDeposito' }] });

    expect(withDirs.direccionesDeposito).toHaveLength(1);
    expect(withDirs.direccionesDeposito[0].direccion).toBe('0xabc');
  });

  test('Usuario.include(\'transaccionesBlockchain\') devuelve la transacción real', async () => {
    const user = await Usuario.create({ email: 'tx@test.com', username: 'tx_user', passwordHash: 'x', rol: 'normal' });
    const cripto = await Criptomoneda.create({ symbol: 'USDT', nombre: 'Tether', red: 'ethereum', decimales: 6 });
    await TransaccionBlockchain.create({
      userId: user.id, criptomonedaId: cripto.id, tipo: 'deposito',
      cantidad: 100, direccionDestino: '0xabc', estado: 'pendiente',
    });

    const withTx = await Usuario.findByPk(user.id, { include: [{ association: 'transaccionesBlockchain' }] });

    expect(withTx.transaccionesBlockchain).toHaveLength(1);
  });
});
