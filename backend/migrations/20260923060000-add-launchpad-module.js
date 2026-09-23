'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('launchpad_presales', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      token_crypto_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      price_usdt: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      hard_cap_usdt: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      soft_cap_usdt: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      min_ticket_usdt: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      max_ticket_usdt: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      start_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      end_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'PENDING',
      },
      total_raised_usdt: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '0',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      }
    });

    await queryInterface.createTable('launchpad_contributions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      presale_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'launchpad_presales',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      amount_usdt: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      token_amount: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      reference: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('launchpad_contributions');
    await queryInterface.dropTable('launchpad_presales');
  }
};
