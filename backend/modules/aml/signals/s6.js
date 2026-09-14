// modules/aml/signals/s6.js
// S6 new-account volume: fires when a recently-opened account has moved an
// unusually large USD volume since signup — a pattern associated with
// money-mule onboarding and smurfing account networks.
// Pure function — no DB access.
const money = require('../../../utils/money');

module.exports = function s6({ accountAgeDays, maxAgeDays, totalUsd, volumeUsd }) {
  if (
    accountAgeDays < maxAgeDays &&
    money.compare(String(totalUsd), String(volumeUsd)) > 0
  ) {
    return {
      signalId: 'S6',
      severity: 'medium',
      evidence: {
        accountAgeDays,
        totalUsd: String(totalUsd),
        volumeUsd: String(volumeUsd),
      },
    };
  }
  return null;
};
