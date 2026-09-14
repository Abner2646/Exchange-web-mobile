// Thin wrapper over the business-config store (Radar #13) for the AML toggles
// and thresholds. Unseeded keys return the in-code default, so shipping the AML
// module changes nothing until an operator flips a toggle from the admin panel.
const businessConfig = require('../config/businessConfig');

const KEYS = Object.freeze({
  MONITORING_ENABLED: 'aml.monitoring.enabled',
  HOLD_ENFORCEMENT_ENABLED: 'aml.holdEnforcement.enabled',
});

async function isMonitoringEnabled() {
  return businessConfig.getBoolean(KEYS.MONITORING_ENABLED, false);
}

async function isHoldEnforcementEnabled() {
  return businessConfig.getBoolean(KEYS.HOLD_ENFORCEMENT_ENABLED, false);
}

async function getThreshold(key, fallback) {
  return businessConfig.getNumber(key, fallback);
}

module.exports = { KEYS, isMonitoringEnabled, isHoldEnforcementEnabled, getThreshold };
