require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const { User } = require('../../models');

// Radar #14 — revisión del modelo de usuario (identidad/perfil por capas) +
// manejo seguro del flag de riesgo AML (§4.8): nunca se serializa (tipping-off),
// pero sigue legible en código para el tooling admin.
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

describe('Usuario — perfil por capas + flag AML seguro', () => {
  test('los campos nuevos existen con sus defaults', async () => {
    const u = await f.seedUser();
    expect(u.kycLevel).toBe('none');
    expect(u.amlRiskLevel).toBe('low');
    expect(u.amlReviewPending).toBe(false);
    // separados y nullable
    expect(u.displayName ?? null).toBeNull();
    expect(u.legalName ?? null).toBeNull();
    expect(u.taxId ?? null).toBeNull();
    expect(u.dateOfBirth ?? null).toBeNull();
  });

  test('toJSON NUNCA expone los flags de riesgo AML (pero siguen legibles en código)', async () => {
    const u = await f.seedUser({ amlRiskLevel: 'high', amlReviewPending: true, taxId: '20-1234-5' });

    // Legible en código (para el tooling admin de AML).
    expect(u.amlRiskLevel).toBe('high');
    expect(u.amlReviewPending).toBe(true);

    // Pero fuera de toda serialización JSON.
    const json = u.toJSON();
    expect(json).not.toHaveProperty('amlRiskLevel');
    expect(json).not.toHaveProperty('amlReviewPending');
    expect(JSON.stringify(u)).not.toContain('amlRiskLevel');

    // El PII del propio dueño sí sale en su instancia (el perfil público a
    // terceros es otro camino, curado).
    expect(json.taxId).toBe('20-1234-5');
  });

  test('updateProfile edita displayName pero NO username, y corta mass-assignment', async () => {
    const u = await f.seedUser();
    const originalUsername = u.username;

    const { user } = await User.updateProfile(u.id, {
      displayName: 'Fulano Visible',
      state: 'Buenos Aires',
      locale: 'es-AR',
      username: 'handle_nuevo',   // ignorado: username es inmutable (Radar #14)
      role: 'admin',               // ignorado: no editable por self-service
      dailyLimitUsd: 999999,    // ignorado
      amlRiskLevel: 'low',     // ignorado (además nunca editable por el usuario)
    });

    expect(user.displayName).toBe('Fulano Visible');
    expect(user.state).toBe('Buenos Aires');
    expect(user.locale).toBe('es-AR');
    expect(user.username).toBe(originalUsername); // inmutable
    expect(user.role).toBe('normal');              // no escaló privilegios
  });
});
