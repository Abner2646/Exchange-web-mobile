// Fase 4.3 — capa de autorización centralizada. Predicados puros reusables que
// reemplazan los checks de rol/ownership ad-hoc dispersos por los controllers
// (`req.user.rol !== 'admin'`, `['admin','super_admin'].includes(...)`, etc.).
// El bug que centralizar arregla: varios sitios usaban `!== 'admin'`, que trata a
// un super_admin como NO-admin (jerarquía rota). Acá super_admin >= admin siempre.
const authz = require('../utils/authz');

const normal = { id: 'u1', rol: 'normal' };
const admin = { id: 'u2', rol: 'admin' };
const superAdmin = { id: 'u3', rol: 'super_admin' };

describe('authz.isAdmin', () => {
  test('admin y super_admin son admin; normal no', () => {
    expect(authz.isAdmin(admin)).toBe(true);
    expect(authz.isAdmin(superAdmin)).toBe(true);
    expect(authz.isAdmin(normal)).toBe(false);
  });
  test('usuario ausente/sin rol → false (no rompe)', () => {
    expect(authz.isAdmin(undefined)).toBe(false);
    expect(authz.isAdmin({})).toBe(false);
  });
  test('normaliza variantes de rol (mayúsculas, "Usuario", "superadmin")', () => {
    expect(authz.isAdmin({ rol: 'ADMIN' })).toBe(true);
    expect(authz.isAdmin({ rol: 'superadmin' })).toBe(true);
    expect(authz.isAdmin({ rol: 'Usuario' })).toBe(false);
  });
});

describe('authz.isSuperAdmin', () => {
  test('solo super_admin', () => {
    expect(authz.isSuperAdmin(superAdmin)).toBe(true);
    expect(authz.isSuperAdmin(admin)).toBe(false);
    expect(authz.isSuperAdmin(normal)).toBe(false);
  });
});

describe('authz.owns', () => {
  test('mismo id (comparación estricta de UUID string)', () => {
    expect(authz.owns(normal, 'u1')).toBe(true);
    expect(authz.owns(normal, 'u2')).toBe(false);
  });
  test('ownerId nulo o user ausente → false', () => {
    expect(authz.owns(normal, null)).toBe(false);
    expect(authz.owns(undefined, 'u1')).toBe(false);
  });
});

describe('authz.canAccessResource (owner OR admin)', () => {
  test('el dueño accede', () => {
    expect(authz.canAccessResource(normal, 'u1')).toBe(true);
  });
  test('un admin no-dueño accede', () => {
    expect(authz.canAccessResource(admin, 'someone-else')).toBe(true);
  });
  test('un super_admin no-dueño accede (arregla la inconsistencia !== admin)', () => {
    expect(authz.canAccessResource(superAdmin, 'someone-else')).toBe(true);
  });
  test('un normal no-dueño NO accede', () => {
    expect(authz.canAccessResource(normal, 'someone-else')).toBe(false);
  });
});
