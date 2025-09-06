const { DataTypes, Model } = require('sequelize');

class CategoriaReclamo extends Model {}

function initCategoriaReclamo(sequelize) {
  CategoriaReclamo.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    activa: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'CategoriaReclamo',
    tableName: 'categorias_reclamos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  return CategoriaReclamo;
}

module.exports = initCategoriaReclamo;