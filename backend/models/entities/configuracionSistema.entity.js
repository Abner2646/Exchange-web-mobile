//Podría reemplazarse con constantes en el .env

// Ejemplos de configuraciones que están en la BD:
/*
{
  clave: 'limite_diario_no_verificado',
  valor: '1000',
  descripcion: 'Límite diario en USD para usuarios no verificados'
}

{
  clave: 'fee_retiro_btc', 
  valor: '0.0005',
  descripcion: 'Fee fijo para retiros de Bitcoin'
}

{
  clave: 'confirmaciones_eth',
  valor: '12', 
  descripcion: 'Confirmaciones requeridas para Ethereum'
}
*/

const { DataTypes, Model } = require('sequelize');

class ConfiguracionSistema extends Model {}

function initConfiguracionSistema(sequelize) {
  ConfiguracionSistema.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    clave: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    valor: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'ConfiguracionSistema',
    tableName: 'configuracion_sistema',
    timestamps: true,
    createdAt: false,
    updatedAt: 'updated_at'
  });

  return ConfiguracionSistema;
}

module.exports = initConfiguracionSistema;