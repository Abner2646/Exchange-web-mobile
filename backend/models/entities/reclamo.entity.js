const { DataTypes, Model } = require('sequelize');

class Reclamo extends Model {}

function initReclamo(sequelize) {
  Reclamo.init({
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
    categoriaId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'categoria_id'
    },
    tipoReclamo: {
      type: DataTypes.ENUM('p2p', 'general'),
      allowNull: false,
      field: 'tipo_reclamo'
    },
    transaccionP2PId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'transaccion_p2p_id'
    },
    asunto: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    estado: {
      type: DataTypes.ENUM('pendiente', 'en_revision', 'resuelto', 'cerrado', 'rechazado'),
      defaultValue: 'pendiente'
    },
    prioridad: {
      type: DataTypes.ENUM('baja', 'media', 'alta'),
      defaultValue: 'media'
    },
    adminAsignadoId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'admin_asignado_id'
    },
    resolucion: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    fechaAsignacion: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'fecha_asignacion'
    },
    fechaResolucion: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'fecha_resolucion'
    }
  }, {
    sequelize,
    modelName: 'Reclamo',
    tableName: 'reclamos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return Reclamo;
}

module.exports = initReclamo;