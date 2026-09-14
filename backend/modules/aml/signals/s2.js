// modules/aml/signals/s2.js
// S2 structuring: fires when several withdrawals fall in the [0.8T, T) band
// (just below a reporting threshold) and their combined value exceeds T.
// This pattern — many sub-threshold transactions — is a classic structuring
// / "smurfing" indicator (FinCEN advisory FIN-2014-A005).
// Pure function — no DB access; unvaluable assets already dropped by the caller.
const money = require('../../../utils/money');

module.exports = function s2({ withdrawalUsds, thresholdUsd, count }) {
  const T = String(thresholdUsd);
  const floor = money.multiply(T, '0.8');
  const matched = withdrawalUsds.filter(
    v => money.compare(String(v), floor) >= 0 && money.compare(String(v), T) < 0
  );
  if (matched.length < count) return null;
  const sum = matched.reduce((acc, v) => money.add(acc, String(v)), '0');
  if (money.compare(sum, T) < 0) return null;
  return {
    signalId: 'S2',
    severity: 'high',
    evidence: { matched: matched.length, sumUsd: sum, thresholdUsd: T },
  };
};
