// modules/audit/verifyAuditChain.js
// Recomputes the audit hash-chain to detect tampering (edited/deleted rows).
const { GENESIS, computeHash } = require('./auditHash');

// Pure: rows are audit_log rows ordered by id ASC.
function verifyRows(rows) {
  let prevHash = GENESIS;
  for (const row of rows) {
    if (row.prevHash !== prevHash) {
      return { ok: false, brokenAtSeq: Number(row.id), checked: rows.length };
    }
    const recomputed = computeHash({
      eventId: row.eventId,
      eventType: row.eventType,
      payload: row.payload,
      aggregateId: row.aggregateId,
      occurredAt: row.occurredAt,
    }, row.prevHash);
    if (recomputed !== row.hash) {
      return { ok: false, brokenAtSeq: Number(row.id), checked: rows.length };
    }
    prevHash = row.hash;
  }
  return { ok: true, brokenAtSeq: null, checked: rows.length };
}

async function verifyAuditChain() {
  const { AuditLog } = require('../../models'); // lazy-require to avoid a cycle
  const rows = await AuditLog.findAll({ order: [['id', 'ASC']] });
  return verifyRows(rows);
}

module.exports = { verifyRows, verifyAuditChain };
