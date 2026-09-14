// modules/aml/aml.controller.js
// Admin surface for AML config, denylist CRUD, and case resolution (§4.8).
// All routes are gated by authenticateToken + isAdmin + requireOperatorMFA.
// Tipping-off protection: case data never appears in user-facing routes —
// only this admin controller exposes it.
const amlConfig = require('./amlConfig');
const businessConfig = require('../config/businessConfig');
const denylist = require('./denylist.model');
const cases = require('./case.model');
const { BlockchainTransaction } = require('../../models');

async function getConfig(req, res) {
  res.json({
    monitoringEnabled: await amlConfig.isMonitoringEnabled(),
    holdEnforcementEnabled: await amlConfig.isHoldEnforcementEnabled(),
  });
}

async function putConfig(req, res) {
  const { key } = req.params;
  if (!key.startsWith('aml.')) return res.status(400).json({ error: 'Solo se permiten claves aml.*' });
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'Falta value' });
  await businessConfig.set(key, value, { category: 'aml' });
  res.json({ key, value: String(value) });
}

async function getDenylist(req, res) {
  res.json(await denylist.listAddresses());
}

async function addDenylist(req, res) {
  const { address, network, reason, source } = req.body;
  if (!address || !network) return res.status(400).json({ error: 'address y network son requeridos' });
  const row = await denylist.addAddress({ address, network, reason, source, addedBy: req.user.id });
  res.status(201).json(row);
}

async function removeDenylist(req, res) {
  const n = await denylist.removeAddress(req.params.id);
  res.json({ removed: n });
}

async function getCases(req, res) {
  res.json(await cases.listCases({ status: req.query.status }));
}

async function resolveCase(req, res) {
  const { decision } = req.body;
  if (!['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ error: 'decision debe ser approve|reject' });
  }
  const c = await cases.getCase(req.params.id);
  if (!c) return res.status(404).json({ error: 'Caso no encontrado' });
  // Don't re-resolve: a second resolve would overwrite resolvedBy/resolvedAt and,
  // for a genuinely-held row, could re-touch the withdrawal. One resolution only.
  if (c.status === 'closed') return res.status(409).json({ error: 'El caso ya está resuelto' });

  // Only touch the withdrawal when it is STILL held (requiresApproval + pending).
  // A shadow-mode case (held:false, the withdrawal proceeded) or one whose
  // withdrawal already progressed is closed WITHOUT any fund action — approving a
  // never-held row would poison approvedBy/approvalDate, and failing a non-pending
  // row would throw. The human decision is still recorded by closing the case.
  if (c.signalId === 'S5' && c.evidence && c.evidence.withdrawalId) {
    const w = await BlockchainTransaction.findByPk(c.evidence.withdrawalId);
    if (w && w.status === 'pending' && w.requiresApproval) {
      if (decision === 'approve') {
        await BlockchainTransaction.approveWithdrawal(w.id, req.user.id); // clear hold → claimable
      } else {
        await BlockchainTransaction.failWithdrawal(w.id, 'AML S5 rejected'); // refund reserved funds
      }
    }
  }

  const resolved = await cases.resolveCase(req.params.id, { status: 'closed', resolvedBy: req.user.id });
  res.json(resolved);
}

module.exports = { getConfig, putConfig, getDenylist, addDenylist, removeDenylist, getCases, resolveCase };
