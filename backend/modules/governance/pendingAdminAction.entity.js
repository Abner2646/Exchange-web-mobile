const { DataTypes, Model } = require('sequelize');

// A privileged action awaiting dual control (Maker-Checker / 4-eyes). NYDFS Part 500
// §500.7 (access controls) + institutional dual-authorization. The maker proposes;
// a DISTINCT checker authorizes with a second factor. Hard rules live in the service.
class PendingAdminAction extends Model {}

function initPendingAdminAction(sequelize) {
  PendingAdminAction.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    actionType: { type: DataTypes.STRING, allowNull: false, field: 'action_type' },
    // Opaque, action-specific parameters (e.g. withdrawalId, newFeeBps, targetUserId).
    payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    // USD-equivalent magnitude of the action, when it has one (drives thresholds and
    // the hard ceiling). Stored as a canonical decimal string; null for non-monetary actions.
    amountUsd: { type: DataTypes.STRING, allowNull: true, field: 'amount_usd' },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'expired', 'executed', 'failed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    makerUserId: { type: DataTypes.UUID, allowNull: false, field: 'maker_user_id', references: { model: 'users', key: 'id' } },
    checkerUserId: { type: DataTypes.UUID, allowNull: true, field: 'checker_user_id', references: { model: 'users', key: 'id' } },
    rejectionReason: { type: DataTypes.STRING, allowNull: true, field: 'rejection_reason' },
    // Result of executing the approved action (or the error), for the audit trail.
    result: { type: DataTypes.JSONB, allowNull: true },
    expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
    resolvedAt: { type: DataTypes.DATE, allowNull: true, field: 'resolved_at' }
  }, {
    sequelize,
    modelName: 'PendingAdminAction',
    tableName: 'pending_admin_actions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return PendingAdminAction;
}

module.exports = initPendingAdminAction;
