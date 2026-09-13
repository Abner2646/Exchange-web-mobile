// scripts/verifyAuditChain.js — manual audit-chain integrity check.
// Usage: node scripts/verifyAuditChain.js  (exit 0 = intact, 1 = broken)
const { sequelize } = require('../models');
const { verifyAuditChain } = require('../modules/audit/verifyAuditChain');

(async () => {
  try {
    await sequelize.authenticate();
    const result = await verifyAuditChain();
    if (result.ok) {
      console.log(`✅ Audit chain intact (${result.checked} records).`);
    } else {
      console.error(`❌ Audit chain BROKEN at seq ${result.brokenAtSeq} (${result.checked} records checked).`);
    }
    await sequelize.close();
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.error('❌ Audit chain verification failed to run:', error.message);
    process.exit(2);
  }
})();
