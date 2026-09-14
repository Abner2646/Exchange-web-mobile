// Synchronous, preventive sanctions screening (AML signal S5). Called at
// withdrawal creation, inside the withdrawal's transaction, BEFORE the funds
// leave. A hit does not itself act — the caller decides (hold vs shadow) based
// on the amlConfig hold-enforcement toggle.
const denylist = require('./denylist.model');

async function checkWithdrawal({ address, network }, transaction = null) {
  const match = await denylist.isDenylisted(address, network, transaction);
  return { denylisted: !!match, match: match || null };
}

module.exports = { checkWithdrawal };
