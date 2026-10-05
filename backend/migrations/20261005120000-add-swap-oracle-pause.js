'use strict';

// Hito 2 — oracle circuit breaker for the swap price feed. The background sweep
// (jobs/oracleBreaker.job.js) pauses a pair when the multi-source oracle reports
// divergence/unavailability; the swap hot-path reads oracle_paused and rejects 503.
// Additive, NOT NULL default false → existing pairs keep transacting unchanged.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('swap_pairs', 'oracle_paused', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('swap_pairs', 'oracle_pause_reason', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('swap_pairs', 'oracle_checked_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('swap_pairs', 'oracle_checked_at');
    await queryInterface.removeColumn('swap_pairs', 'oracle_pause_reason');
    await queryInterface.removeColumn('swap_pairs', 'oracle_paused');
  },
};
