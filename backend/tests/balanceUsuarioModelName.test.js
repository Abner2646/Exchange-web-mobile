const { sequelize, BalanceUsuario } = require('../models/index');

describe('BalanceUsuario model naming (AUDITORIA_BACKEND.md Altos #15)', () => {
  afterAll(async () => {
    await sequelize.close();
  });

  test('registers under sequelize.models.BalanceUsuario, matching the rest of the domain naming', () => {
    expect(sequelize.models.BalanceUsuario).toBeDefined();
    expect(sequelize.models.BalanceUsuario).toBe(BalanceUsuario);
  });

  test('no longer registers the old inconsistent modelName BalanceUser', () => {
    expect(sequelize.models.BalanceUser).toBeUndefined();
  });

  test('model options report BalanceUsuario as their own modelName', () => {
    expect(BalanceUsuario.options.name.singular.toLowerCase()).toBe('balanceusuario');
  });
});
