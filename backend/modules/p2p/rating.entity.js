const { DataTypes, Model } = require('sequelize');

class Rating extends Model {}

function initValoracion(sequelize) {
  Rating.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    p2pTransactionId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'p2p_transaction_id'
    },
    raterId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'rater_id'
    },
    ratedUserId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'rated_user_id'
    },
    score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5
      }
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Rating',
    tableName: 'ratings',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        // ✅ SOLUCIÓN: Darle un name explícito y corto al índice
        name: 'idx_valoracion_unique',
        unique: true,
        fields: ['p2p_transaction_id', 'rater_id', 'rated_user_id']
      }
    ]
  });

  return Rating;
}

module.exports = initValoracion;