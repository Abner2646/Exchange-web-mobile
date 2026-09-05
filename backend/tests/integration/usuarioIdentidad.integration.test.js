require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const { Usuario } = require('../../models');

// Radar #14 — revisión del modelo de usuario (identidad/perfil por capas) +
// manejo seguro del flag de riesgo AML (§4.8): nunca se serializa (tipping-off),
// pero sigue legible en código para el tooling admin.
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

describe('Usuario — perfil por capas + flag AML seguro', () => {
  test('los campos nuevos existen con sus defaults', async () => {
    const u = await f.seedUser();
    expect(u.nivelKyc).toBe('ninguno');
    expect(u.nivelRiesgoAml).toBe('bajo');
    expect(u.revisionAmlPendiente).toBe(false);
    // separados y nullable
    expect(u.displayName ?? null).toBeNull();
    expect(u.nombreLegal ?? null).toBeNull();
    expect(u.taxId ?? null).toBeNull();
    expect(u.fechaNacimiento ?? null).toBeNull();
  });

  test('toJSON NUNCA expone los flags de riesgo AML (pero siguen legibles en código)', async () => {
    const u = await f.seedUser({ nivelRiesgoAml: 'alto', revisionAmlPendiente: true, taxId: '20-1234-5' });

    // Legible en código (para el tooling admin de AML).
    expect(u.nivelRiesgoAml).toBe('alto');
    expect(u.revisionAmlPendiente).toBe(true);

    // Pero fuera de toda serialización JSON.
    const json = u.toJSON();
    expect(json).not.toHaveProperty('nivelRiesgoAml');
    expect(json).not.toHaveProperty('revisionAmlPendiente');
    expect(JSON.stringify(u)).not.toContain('nivelRiesgoAml');

    // El PII del propio dueño sí sale en su instancia (el perfil público a
    // terceros es otro camino, curado).
    expect(json.taxId).toBe('20-1234-5');
  });

  test('updateProfile edita displayName pero NO username, y corta mass-assignment', async () => {
    const u = await f.seedUser();
    const originalUsername = u.username;

    const { user } = await Usuario.updateProfile(u.id, {
      displayName: 'Fulano Visible',
      estado: 'Buenos Aires',
      locale: 'es-AR',
      username: 'handle_nuevo',   // ignorado: username es inmutable (Radar #14)
      rol: 'admin',               // ignorado: no editable por self-service
      limiteDiarioUsd: 999999,    // ignorado
      nivelRiesgoAml: 'bajo',     // ignorado (además nunca editable por el usuario)
    });

    expect(user.displayName).toBe('Fulano Visible');
    expect(user.estado).toBe('Buenos Aires');
    expect(user.locale).toBe('es-AR');
    expect(user.username).toBe(originalUsername); // inmutable
    expect(user.rol).toBe('normal');              // no escaló privilegios
  });
});
