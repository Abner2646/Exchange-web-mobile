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

  if (c.signalId === 'S5' && c.evidence && c.evidence.withdrawalId) {
    const wId = c.evidence.withdrawalId;
    if (decision === 'approve') {
      // Clear hold so claimForProcessing's WHERE (requiresApproval:false) matches.
      await BlockchainTransaction.approveWithdrawal(wId, req.user.id);
    } else {
      // Refund reserved funds via the existing reaper path: unblocks balance +
      // marks withdrawal failed. Guards against non-pending/processing status.
      await BlockchainTransaction.failWithdrawal(wId, 'AML S5 rejected');
    }
  }

  const resolved = await cases.resolveCase(req.params.id, { status: 'closed', resolvedBy: req.user.id });
  res.json(resolved);
}

module.exports = { getConfig, putConfig, getDenylist, addDenylist, removeDenylist, getCases, resolveCase };
