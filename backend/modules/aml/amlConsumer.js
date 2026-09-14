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

  const results = await evaluator.evaluate(event);
  for (const r of results) {
    const { created } = await cases.openCase({
      userId: r.userId,
      signalId: r.finding.signalId,
      severity: r.finding.severity,
      evidence: r.finding.evidence,
      dedupeKey: r.dedupeKey,
      sourceEventId: event.id,
    });
    // Only raise risk and flag alsoFlag parties when a NEW case is created.
    // If openCase returns created=false the case already exists — idempotent.
    if (created) {
      await riskFlag.raiseUserRisk(r.userId, r.finding.severity);
      for (const other of (r.alsoFlag || [])) {
        await riskFlag.raiseUserRisk(other, r.finding.severity);
      }
    }
  }
}

function register(eventBus) {
  for (const t of TRIGGER_TYPES) {
    eventBus.on(t, 'aml', handleEvent);
  }
}

module.exports = { handleEvent, register, TRIGGER_TYPES };
