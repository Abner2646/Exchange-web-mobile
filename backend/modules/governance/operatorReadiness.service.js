// modules/governance/operatorReadiness.service.js
//
// Deploy readiness gate for Maker-Checker dual control.
//
// After the TOTP migration every operator starts with `totpEnabled = false`. Large
// withdrawals are now HELD until a DISTINCT operator (the checker) releases them by
// approving with a valid TOTP code. Releasing therefore requires an operator who:
//   (a) passes `requireOperatorMFA`  → role >= admin AND `twoFactorEnabled = true`, and
//   (b) passes `totp.verifyForUser`  → `totpEnabled = true` with a valid single-use code.
// The 4-eyes rule additionally forbids checker === maker.
//
// So dual control is only *usable* when at least TWO distinct operators are fully MFA
// enrolled — otherwise a held large withdrawal can never be released and its funds stay
// blocked. This module assesses that invariant as a pure, testable function so a deploy
// script (or CI gate) can fail closed BEFORE dual control is relied upon in a live env.
//
// Audit note: enrollment is self-service (the operator scans a QR with their authenticator
// app via `/api/user/me/totp/{setup,enable}`); no secret material is ever generated,
// stored, or printed by this readiness path. See docs/runbooks/operator-totp-enrollment.md.

// Two enrolled operators is the minimum for a satisfiable maker≠checker release.
const DEFAULT_MIN_ENROLLED = 2;

// An operator is release-capable only when BOTH flags are set (see (a)/(b) above).
function isEnrolled(op) {
  return !!(op && op.totpEnabled && op.twoFactorEnabled);
}

// Project only non-sensitive fields — never echo totpSecret/password into a report.
function summarize(op) {
  return {
    id: op.id,
    email: op.email,
    role: op.role,
    totpEnabled: !!op.totpEnabled,
    twoFactorEnabled: !!op.twoFactorEnabled,
  };
}

// Pure assessment. `operators` is a plain array of loaded operator records (role >= admin).
// Returns { ready, operatorCount, enrolledCount, minEnrolled, enrolled[], pending[], reasons[] }.
function assessMfaReadiness(operators, { minEnrolled = DEFAULT_MIN_ENROLLED } = {}) {
  const list = Array.isArray(operators) ? operators : [];
  const enrolled = list.filter(isEnrolled);
  const pending = list.filter((o) => !isEnrolled(o));
  const reasons = [];

  if (list.length === 0) {
    reasons.push('No hay operadores (role admin/super_admin) en el sistema.');
  }
  if (enrolled.length < minEnrolled) {
    reasons.push(
      `Se requieren al menos ${minEnrolled} operadores con TOTP habilitado para que el ` +
      `control dual (maker≠checker) sea liberable; hay ${enrolled.length}.`
    );
  }

  return {
    ready: reasons.length === 0,
    operatorCount: list.length,
    enrolledCount: enrolled.length,
    minEnrolled,
    enrolled: enrolled.map(summarize),
    pending: pending.map(summarize),
    reasons,
  };
}

// Operator roles as stored by the User ENUM (see user.entity.js). Anything below `admin`
// is a normal customer and never an operator.
const OPERATOR_ROLES = ['admin', 'super_admin'];

// Thin DB wrapper: load the operator records the gate needs. Projects only the fields the
// pure assessor consumes (never totpSecret). Kept separate from `assessMfaReadiness` so the
// invariant stays unit-testable without a database.
async function loadOperators() {
  const { User } = require('../../models');
  const { Op } = require('sequelize');
  return User.findAll({
    where: { role: { [Op.in]: OPERATOR_ROLES } },
    attributes: ['id', 'email', 'role', 'totpEnabled', 'twoFactorEnabled'],
    order: [['role', 'DESC'], ['email', 'ASC']],
  });
}

module.exports = {
  DEFAULT_MIN_ENROLLED,
  OPERATOR_ROLES,
  isEnrolled,
  assessMfaReadiness,
  loadOperators,
};
