const { sequelize, UserBalance } = require('../models/index');

// Paso C: balances_users se eliminó y UserBalance dejó de ser un modelo
// Sequelize — ahora es una FACHADA respaldada por el ledger de partida doble.
// (Reemplaza al viejo test de naming de Altos #15, cuyo sujeto ya no existe.)
describe('UserBalance es una fachada del ledger, no un modelo Sequelize (Paso C)', () => {
  afterAll(async () => {
    await sequelize.close();
  });

  test('ya no está registrado como modelo Sequelize (ni como el viejo BalanceUser)', () => {
    expect(sequelize.models.UserBalance).toBeUndefined();
    expect(sequelize.models.BalanceUser).toBeUndefined();
  });

  test('sigue exponiendo la API de saldos respaldada por el ledger', () => {
    expect(typeof UserBalance.updateBalance).toBe('function');
    expect(typeof UserBalance.blockBalance).toBe('function');
    expect(typeof UserBalance.unblockBalance).toBe('function');
    expect(typeof UserBalance.getByUserAndCrypto).toBe('function');
    expect(typeof UserBalance.getByUserId).toBe('function');
  });
});
