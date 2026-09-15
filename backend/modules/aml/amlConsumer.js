// modules/aml/amlConsumer.js
// Detective AML consumer. On each money event, if monitoring is enabled, evaluate the
// signals and persist idempotent cases + raise the risk flag. Never touches funds.
const amlConfig = require('./amlConfig');
const evaluator = require('./amlEvaluator');
const cases = require('./case.model');
const riskFlag = require('./riskFlag');

const TRIGGER_TYPES = ['DepositConfirmed', 'WithdrawalTransmitted', 'P2PTransactionCompleted'];

async function handleEvent(event) {
  // Monitoring gate MUST be first — default-off guarantees no-op until an operator
  // enables monitoring. This is load-bearing for the existing test suite.
  if (!(await amlConfig.isMonitoringEnabled())) return;

  const { sequelize } = require('../../models');
  const results = await evaluator.evaluate(event);
  for (const r of results) {
    // Open the case and raise the risk flag ATOMICALLY. If the raise throws after
    // the case commits, a later at-least-once retry would see created=false and
    // never raise the flag — the elevation would be permanently lost. One
    // transaction makes them commit or roll back together, so a retry re-does both.
    await sequelize.transaction(async (t) => {
      const { created } = await cases.openCase({
        userId: r.userId,
        signalId: r.finding.signalId,
        severity: r.finding.severity,
        evidence: r.finding.evidence,
        dedupeKey: r.dedupeKey,
        sourceEventId: event.id,
      }, t);
      // Only raise on a NEW case — a duplicate delivery (created=false) is a no-op.
      if (created) {
        await riskFlag.raiseUserRisk(r.userId, r.finding.severity, t);
        for (const other of (r.alsoFlag || [])) {
          await riskFlag.raiseUserRisk(other, r.finding.severity, t);
        }
      }
    });
  }
}

function register(eventBus) {
  for (const t of TRIGGER_TYPES) {
    eventBus.on(t, 'aml', handleEvent);
  }
}

module.exports = { handleEvent, register, TRIGGER_TYPES };
