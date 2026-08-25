require('./testEnv');
const { sequelize } = require('../../models');

// Runs once before the whole integration run: create the schema fresh.
async function globalSetup() {
  await sequelize.authenticate();
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
