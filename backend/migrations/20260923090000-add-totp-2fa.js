'use strict';

// TOTP (authenticator-app) 2FA columns. Additive and nullable/default — safe on a live
// users table. `totp_secret` holds the base32 shared secret (set at enrollment, pending
// until the first token is verified); `totp_enabled` flips true once verified.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'totp_secret', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'totp_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'totp_enabled');
    await queryInterface.removeColumn('users', 'totp_secret');
  }
};
