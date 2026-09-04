// utils/authz.js
//
// Fase 4.3 — capa de autorización centralizada. Única fuente de las decisiones de
// rol/ownership, para no repetir `req.user.rol !== 'admin'` (que además rompía la
// jerarquía: trataba a super_admin como no-admin) ni `['admin','super_admin']
// .includes(...)` por cada controller. Predicados PUROS (devuelven boolean, no
// tocan res): el controller sigue lanzando su AppError tipado (envelope canónico)
// usando estos predicados. La jerarquía es normal(1) < admin(2) < super_admin(3);
// mismo mapeo de normalización que `middleware/adminMiddleware.js`.

const LEVEL = {
  normal: 1, usuario: 1, user: 1,
  admin: 2, administrator: 2,
  super_admin: 3, superadmin: 3, 'super-admin': 3,
};

function level(rol) {
  return LEVEL[String(rol || '').toLowerCase()] || 0;
}

// ¿El usuario tiene rol admin o superior (super_admin incluido)?
function isAdmin(user) {
  return !!user && level(user.rol) >= LEVEL.admin;
}

// ¿El usuario es super_admin?
function isSuperAdmin(user) {
  return !!user && level(user.rol) >= LEVEL.super_admin;
}

// ¿El usuario es el dueño del recurso? Comparación estricta (UUID string).
function owns(user, ownerId) {
  return !!user && ownerId != null && user.id === ownerId;
}

// Patrón "owner OR admin" (el más común en los controllers): el dueño del recurso
// o cualquier admin/super_admin pueden acceder.
function canAccessResource(user, ownerId) {
  return owns(user, ownerId) || isAdmin(user);
}

module.exports = { level, isAdmin, isSuperAdmin, owns, canAccessResource };
