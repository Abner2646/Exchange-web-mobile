// modules/audit/audit.controller.js
// Read-only admin viewer over the tamper-evident audit_log. NEVER mutates the chain:
// `list` is a keyset-paginated read (id DESC) and `verify` recomputes the hash-chain via
// the already-tested `verifyAuditChain`. Admin-gated at the route (isAdmin); no write, so
// no operator-MFA step-up is required to READ the log.
const { Op } = require('sequelize');
const { verifyAuditChain } = require('./verifyAuditChain');

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

async function list(req, res) {
  const { AuditLog } = require('../../models'); // lazy-require to avoid a model-init cycle
  const raw = parseInt(req.query.limit, 10);
  const limit = Number.isInteger(raw) ? Math.min(Math.max(raw, 1), MAX_LIMIT) : DEFAULT_LIMIT;

  const where = {};
  if (req.query.eventType) where.eventType = req.query.eventType;
  if (req.query.aggregateId) where.aggregateId = req.query.aggregateId;
  const beforeId = parseInt(req.query.beforeId, 10);
  if (Number.isInteger(beforeId)) where.id = { [Op.lt]: beforeId };

  const found = await AuditLog.findAll({ where, order: [['id', 'DESC']], limit });
  const rows = found.map((r) => (typeof r.toJSON === 'function' ? r.toJSON() : r));
  // A full page implies there may be more; the last row's id is the next keyset cursor.
  const nextBeforeId = rows.length === limit && rows.length > 0 ? Number(rows[rows.length - 1].id) : null;
  res.json({ rows, nextBeforeId });
}

async function verify(req, res) {
  res.json(await verifyAuditChain());
}

module.exports = { list, verify };
