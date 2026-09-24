'use strict';

// Hito 11 — dual control for large withdrawals. A boolean hold on blockchain_transactions,
// independent of the AML S5 hold (`requires_approval`), so the two controls never release each
// other. Additive + NOT NULL default false → existing rows keep their current (transmittable)
// behavior. Indexed because the transmit-claim WHERE filters on it.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('blockchain_transactions', 'dual_control_pending', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addIndex('blockchain_transactions', ['dual_control_pending']);
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('blockchain_transactions', ['dual_control_pending']);
    await queryInterface.removeColumn('blockchain_transactions', 'dual_control_pending');
  },
};
