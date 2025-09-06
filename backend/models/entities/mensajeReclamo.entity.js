const { DataTypes, Model } = require('sequelize');

class MensajeReclamo extends Model {}

function initMensajeReclamo(sequelize) {
  MensajeReclamo.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    reclamoId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'reclamo_id'
    },
    autorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'autor_id'
    },
    mensaje: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    esAdmin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'es_admin'
    },
    adjuntos: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'MensajeReclamo',
    tableName: 'mensajes_reclamos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  return MensajeReclamo;
}

module.exports = initMensajeReclamo;