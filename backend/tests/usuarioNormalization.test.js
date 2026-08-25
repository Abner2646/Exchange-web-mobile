// tests/usuarioNormalization.test.js
//
// Fase 1 — case-sensitivity de email/username. La unicidad se apoyaba en que
// cada método de escritura hiciera `.toLowerCase()` a mano, pero hay paths que
// lo saltean (ej. el alta de Google en services/user.service.js crea con el
// email/username crudos de Google). El `unique` de Postgres es case-sensitive
// sobre los bytes guardados, así que un email MixedCase no colisiona con su
// versión lowercase → dos cuentas para el mismo email. La normalización en un
// hook beforeValidate del entity se aplica en TODO create/update, cerrando la
// ventana sin depender de disciplina por-caller.

const { Sequelize } = require('sequelize');
const initUsuario = require('../models/entities/usuario.entity');

// Instancia que no conecta: build() + runHooks() corren en memoria.
const sequelize = new Sequelize('postgres://u:p@localhost:5432/none', { logging: false });
const Usuario = initUsuario(sequelize);

describe('Usuario — normalización de email/username en beforeValidate', () => {
  test('baja a minúsculas y recorta email y username', async () => {
    const u = Usuario.build({ email: '  John.Doe@Gmail.COM ', username: '  JohnDoe ' });
    await Usuario.runHooks('beforeValidate', u, {});
    expect(u.email).toBe('john.doe@gmail.com');
    expect(u.username).toBe('johndoe');
  });

  test('normaliza solo los campos presentes (safe en updates parciales)', async () => {
    const u = Usuario.build({ username: 'OnlyUser' });
    await Usuario.runHooks('beforeValidate', u, {});
    expect(u.username).toBe('onlyuser');
    expect(u.email == null).toBe(true);
  });
});
