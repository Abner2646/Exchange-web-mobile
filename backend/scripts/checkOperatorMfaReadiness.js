#!/usr/bin/env node
// backend/scripts/checkOperatorMfaReadiness.js
//
// Deploy gate: verify Maker-Checker dual control is actually USABLE before relying on it
// in a live environment. After the TOTP migration every operator starts un-enrolled, so a
// held large withdrawal could never be released (funds stuck). This script fails CLOSED
// (non-zero exit) until at least MIN_ENROLLED operators have self-enrolled TOTP.
//
// Read-only. Prints NO secret material — only per-operator enrollment status. Enrollment
// itself is self-service via POST /api/user/me/totp/{setup,enable}; see the runbook at
// docs/runbooks/operator-totp-enrollment.md.
//
// Usage:
//   node backend/scripts/checkOperatorMfaReadiness.js
//   OPERATOR_MFA_MIN_ENROLLED=3 node backend/scripts/checkOperatorMfaReadiness.js
//
// Exit codes: 0 = ready (dual control releasable), 1 = NOT ready, 2 = error.
require('dotenv').config();
const { sequelize } = require('../models');
const readiness = require('../modules/governance/operatorReadiness.service');

function line(op) {
  const totp = op.totpEnabled ? 'TOTP✓' : 'TOTP✗';
  const twofa = op.twoFactorEnabled ? '2FA✓' : '2FA✗';
  return `  - ${op.email || op.id} [${op.role}]  ${totp}  ${twofa}`;
}

async function main() {
  // Fail closed on a bad override (negative / zero / non-integer) → use the default, never a value
  // that would make the gate fail-open. assessMfaReadiness clamps too (defense in depth).
  const raw = Number(process.env.OPERATOR_MFA_MIN_ENROLLED);
  const minEnrolled = (Number.isInteger(raw) && raw >= 1) ? raw : readiness.DEFAULT_MIN_ENROLLED;
  await sequelize.authenticate();

  const operators = await readiness.loadOperators();
  const report = readiness.assessMfaReadiness(operators, { minEnrolled });

  console.log('\n=== Operator MFA readiness (Maker-Checker dual control) ===');
  console.log(`Operadores: ${report.operatorCount} | Enrolados (TOTP+2FA): ${report.enrolledCount} | Requerido: ${report.minEnrolled}\n`);

  if (report.enrolled.length) {
    console.log('Enrolados (pueden actuar de checker):');
    report.enrolled.forEach((op) => console.log(line(op)));
  }
  if (report.pending.length) {
    console.log('\nPendientes de enrolar TOTP:');
    report.pending.forEach((op) => console.log(line(op)));
  }

  if (report.ready) {
    console.log('\n✅ READY — el control dual es liberable (hay checkers distintos con TOTP).');
    return 0;
  }
  console.log('\n❌ NOT READY — el control dual NO puede liberar retiros grandes:');
  report.reasons.forEach((r) => console.log(`   • ${r}`));
  console.log('\n   Acción: que los operadores enrolen TOTP vía POST /api/user/me/totp/{setup,enable}.');
  console.log('   Runbook: docs/runbooks/operator-totp-enrollment.md');
  return 1;
}

main()
  .then(async (code) => { await sequelize.close(); process.exit(code); })
  .catch(async (err) => {
    console.error('❌ Error verificando readiness de operadores:', err.message);
    try { await sequelize.close(); } catch (_) { /* ignore */ }
    process.exit(2);
  });
