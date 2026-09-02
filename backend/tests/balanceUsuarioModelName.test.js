const { sequelize, BalanceUsuario } = require('../models/index');

// Paso C: balances_users se eliminó y BalanceUsuario dejó de ser un modelo
// Sequelize — ahora es una FACHADA respaldada por el ledger de partida doble.
// (Reemplaza al viejo test de naming de Altos #15, cuyo sujeto ya no existe.)
describe('BalanceUsuario es una fachada del ledger, no un modelo Sequelize (Paso C)', () => {
  afterAll(async () => {
    await sequelize.close();
  });

  test('ya no está registrado como modelo Sequelize (ni como el viejo BalanceUser)', () => {
    expect(sequelize.models.BalanceUsuario).toBeUndefined();
    expect(sequelize.models.BalanceUser).toBeUndefined();
  });

  test('sigue exponiendo la API de saldos respaldada por el ledger', () => {
    expect(typeof BalanceUsuario.updateBalance).toBe('function');
    expect(typeof BalanceUsuario.blockBalance).toBe('function');
    expect(typeof BalanceUsuario.unblockBalance).toBe('function');
    expect(typeof BalanceUsuario.getByUserAndCrypto).toBe('function');
    expect(typeof BalanceUsuario.getByUserId).toBe('function');
  });
});
