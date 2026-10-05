require('./testEnv');
const { sequelize } = require('../../models');

// Runs once before the whole integration run: create the schema fresh.
async function globalSetup() {
  await sequelize.authenticate();
  // models/index only imports the core models. Several module models register
  // LAZILY (governance, referrals, launchpad, kyc) — they only attach to
  // sequelize.models when their module is first required. Load the full route tree
  // (what the running app loads) BEFORE sync({force:true}), otherwise their tables
  // (pending_admin_actions, referral_*, presales, kyc_webhook_events) are never
  // created and every integration test that touches them fails with
  // "relation does not exist". require is idempotent, so this is cheap.
  require('../../routes');
  await sequelize.sync({ force: true });
  await sequelize.close();
}

// Runs once after the whole integration run.
async function globalTeardown() {
  // The setup connection is already closed; nothing global to tear down here.
}

// Per-test clean slate: wipe every table, reset identities.
async function resetDb() {
  await sequelize.truncate({ cascade: true, restartIdentity: true });
}

module.exports = { globalSetup, globalTeardown, resetDb, sequelize };
