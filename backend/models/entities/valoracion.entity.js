const { DataTypes, Model } = require('sequelize');

class Valoracion extends Model {}

function initValoracion(sequelize) {
  Valoracion.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    transaccionP2PId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'transaccion_p2p_id'
    },
    usuarioEvaluadorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'usuario_evaluador_id'
    },
    usuarioEvaluadoId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'usuario_evaluado_id'
    },
    puntuacion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5
      }
    },
    comentario: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Valoracion',
    tableName: 'valoraciones',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        // ✅ SOLUCIÓN: Darle un nombre explícito y corto al índice
        name: 'idx_valoracion_unique',
        unique: true,
        fields: ['transaccion_p2p_id', 'usuario_evaluador_id', 'usuario_evaluado_id']
      }
    ]
  });

  return Valoracion;
}

module.exports = initValoracion;