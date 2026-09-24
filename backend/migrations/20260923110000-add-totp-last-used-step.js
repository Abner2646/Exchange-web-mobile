'use strict';

// TOTP single-use hardening: track the highest 30s step a user has already consumed so a code
// (bound to its step) can never be replayed within its acceptance window. Additive + nullable →
// existing users start at null (no code consumed yet), identical behavior until their next verify.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'totp_last_used_step', {
      type: Sequelize.BIGINT,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'totp_last_used_step');
  },
};
