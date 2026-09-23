'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('pending_admin_actions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      action_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      payload: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      amount_usd: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected', 'expired', 'executed', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      maker_user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      checker_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      rejection_reason: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      result: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      resolved_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('pending_admin_actions', ['status']);
    await queryInterface.addIndex('pending_admin_actions', ['maker_user_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('pending_admin_actions');
    // The ENUM type must be dropped explicitly on Postgres.
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_pending_admin_actions_status";');
  },
};
