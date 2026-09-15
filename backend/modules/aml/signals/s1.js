// modules/aml/signals/s1.js
// S1 volume: fires when on-chain volume in the rolling window exceeds
// the user's daily limit times a configurable multiplier.
// Pure function — no DB access.
const money = require('../../../utils/money');

module.exports = function s1({ totalUsd, limitUsd, multiplier }) {
  const ceiling = money.multiply(String(limitUsd), String(multiplier));
  if (money.compare(String(totalUsd), ceiling) > 0) {
    return {
      signalId: 'S1',
      severity: 'medium',
      evidence: {
        totalUsd: String(totalUsd),
        limitUsd: String(limitUsd),
        multiplier: String(multiplier),
      },
    };
  }
  return null;
};
