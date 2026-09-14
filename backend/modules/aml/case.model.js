// modules/aml/case.model.js
// The AML case queue. Idempotent by dedupeKey so at-least-once event delivery
// and the on-event/sweep double-path never open the same case twice.

async function openCase({ userId, signalId, severity, evidence, dedupeKey, sourceEventId = null }, transaction = null) {
  const { AmlCase } = require('../../models');
  const [row, created] = await AmlCase.findOrCreate({
    where: { dedupeKey },
    defaults: { userId, signalId, severity, evidence, sourceEventId, status: 'open' },
    transaction,
  });
  return { case: row, created };
}

async function resolveCase(id, { status, resolvedBy }, transaction = null) {
  const { AmlCase } = require('../../models');
  await AmlCase.update(
    { status, resolvedBy, resolvedAt: new Date() },
    { where: { id }, transaction }
  );
  return AmlCase.findByPk(id, { transaction });
}

async function listCases(filter = {}) {
  const { AmlCase } = require('../../models');
  const where = {};
  if (filter.status) where.status = filter.status;
  if (filter.userId) where.userId = filter.userId;
  return AmlCase.findAll({ where, order: [['created_at', 'DESC']] });
}

async function getCase(id) {
  const { AmlCase } = require('../../models');
  return AmlCase.findByPk(id);
}

module.exports = { openCase, resolveCase, listCases, getCase };
