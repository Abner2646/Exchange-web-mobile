// tests/balanceUsuario.model.test.js
//
// Fase 1 — precisión monetaria. Este es el punto REAL donde los saldos se
// acumulan y se guardan: updateBalance/blockBalance/unblockBalance hacían
// `parseFloat(saldoActual) + parseFloat(monto)` (float binario IEEE 754), así
// que cada operación arrastraba error de coma sobre el saldo persistido.
// Después de la migración toda la aritmética pasa por money.js (decimal.js) y
// los saldos se guardan como string canónico exacto.

jest.mock('../models/entities/balanceUsuario.entity');

const initBalanceUser = require('../models/entities/balanceUsuario.entity');
const createBalanceUserModel = require('../models/balanceUsuario.model');

// El factory hace `const BalanceUsuario = initBalanceUser(sequelize)` y le
// cuelga los métodos estáticos: devolvemos un objeto plano que controlamos.
const fakeModel = {};
initBalanceUser.mockReturnValue(fakeModel);
const sequelize = { transaction: jest.fn() };
const BalanceUsuario = createBalanceUserModel(sequelize);

// Sequelize devuelve las columnas DECIMAL como string; los mocks lo replican.
const txWithLock = { LOCK: { UPDATE: 'UPDATE' } };

describe('BalanceUsuario.updateBalance — acumula saldo exacto', () => {
  test('0.1 + 0.2 guarda "0.3", no 0.30000000000000004', async () => {
    const balance = { balanceDisponible: '0.1', balanceBloqueado: '0', save: jest.fn() };
    BalanceUsuario.findOrCreate = jest.fn().mockResolvedValue([balance]);

    await BalanceUsuario.updateBalance('u', 'c', '0.2', 'disponible', {});

    expect(balance.balanceDisponible).toBe('0.3');
    expect(balance.save).toHaveBeenCalled();
  });

  test('sigue rechazando saldo resultante negativo', async () => {
    const balance = { balanceDisponible: '0.1', balanceBloqueado: '0', save: jest.fn() };
    BalanceUsuario.findOrCreate = jest.fn().mockResolvedValue([balance]);

    await expect(
      BalanceUsuario.updateBalance('u', 'c', '-0.2', 'disponible', {})
    ).rejects.toThrow(/insuficiente/i);
  });
});

describe('BalanceUsuario.blockBalance — mueve disponible->bloqueado exacto', () => {
  test('0.3-0.1 y 0.2+0.1 sin error de coma', async () => {
    const balance = { balanceDisponible: '0.3', balanceBloqueado: '0.2', save: jest.fn() };
    BalanceUsuario.findOne = jest.fn().mockResolvedValue(balance);

    await BalanceUsuario.blockBalance('u', 'c', '0.1', txWithLock);

    // float daría 0.19999999999999998 y 0.30000000000000004
    expect(balance.balanceDisponible).toBe('0.2');
    expect(balance.balanceBloqueado).toBe('0.3');
  });

  test('rechaza si no hay disponible suficiente', async () => {
    const balance = { balanceDisponible: '0.05', balanceBloqueado: '0', save: jest.fn() };
    BalanceUsuario.findOne = jest.fn().mockResolvedValue(balance);

    await expect(
      BalanceUsuario.blockBalance('u', 'c', '0.1', txWithLock)
    ).rejects.toThrow(/insuficiente/i);
  });
});

describe('BalanceUsuario.unblockBalance — mueve bloqueado->disponible exacto', () => {
  test('0.3-0.1 y 0.2+0.1 sin error de coma', async () => {
    const balance = { balanceDisponible: '0.2', balanceBloqueado: '0.3', save: jest.fn() };
    BalanceUsuario.findOne = jest.fn().mockResolvedValue(balance);

    await BalanceUsuario.unblockBalance('u', 'c', '0.1', txWithLock);

    expect(balance.balanceBloqueado).toBe('0.2');
    expect(balance.balanceDisponible).toBe('0.3');
  });
});

// NOTA (Plan 3, read-flip): getTotalBalance y hasAvailableBalance ya NO leen de
// balances_users via findOne — ahora leen de la proyeccion del ledger
// (leerFundingDesdeLedger). Por eso dejaron de ser unit-mockables y sus tests
// viven ahora en tests/integration/ledgerReadFlip.integration.test.js (con DB
// real). La exactitud monetaria sigue garantizada porque ambos metodos usan
// money.add/money.compare (unit-testeados en money.test.js). Los tests de
// updateBalance/blockBalance/unblockBalance de arriba siguen aca: esos metodos
// son ESCRITURAS y siguen basados en findOne/findOrCreate (balances_users +
// mirror), no se flipearon.
