/*
Retiros y depósitos con el exchange
Es el puente entre el exchange y la blockchain real! Es una entidad crítica!
*/

const { DataTypes, Model } = require('sequelize');

class BlockchainTransaction extends Model {}

function initBlockchainTransaction(sequelize) {
  BlockchainTransaction.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id'
    },
    cryptoId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'crypto_id'
    },
    type: {
      type: DataTypes.ENUM('deposit', 'withdrawal'),
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(28, 8),
      allowNull: false
    },
    destinationAddress: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'destination_address'
    },
    sourceAddress: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'source_address'
    },
    txHash: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      field: 'tx_hash'
    },
    blockchainFee: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: true,
      field: 'blockchain_fee'
    },
    confirmations: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    requiredConfirmations: {
      type: DataTypes.INTEGER,
      defaultValue: 6,
      field: 'required_confirmations'
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'confirmed', 'completed', 'failed'),
      defaultValue: 'pending'
    },
    requiresApproval: {
      type: DataTypes.BOOLEAN,
      allowNull: false, // NOT NULL: el pipeline de transmisión filtra `requiresApproval:false`
      defaultValue: false, // con igualdad estricta SQL (= false), que excluye filas NULL y las
      field: 'requires_approval' // dejaría trabadas. Sin NULL posible, esos filtros son correctos.
    },
    // Dual-control (Maker-Checker / 4-eyes) hold for LARGE withdrawals — independent of the
    // AML S5 hold (`requiresApproval`). A withdrawal is transmittable only when BOTH are
    // false (claimForProcessing filters on both), so neither control can release the other.
    // Set at creation when the server-computed USD magnitude crosses the threshold/ceiling;
    // cleared only by a DISTINCT checker's approval via the governance engine.
    dualControlPending: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'dual_control_pending'
    },
    approvedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'approved_by'
    },
    approvalDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'approval_date'
    }
  }, {
    sequelize,
    modelName: 'BlockchainTransaction',
    tableName: 'blockchain_transactions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return BlockchainTransaction;
}

module.exports = initBlockchainTransaction;
