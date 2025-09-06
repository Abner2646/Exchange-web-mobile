const { DataTypes, Model } = require('sequelize');

class OfertaP2P extends Model {}

function initOfertaP2P(sequelize) {
  OfertaP2P.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'usuario_id'
    },
    tipo: {
      type: DataTypes.ENUM('compra', 'venta'),
      allowNull: false
    },
    criptomonedaId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'criptomoneda_id'
    },
    cantidadMin: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'cantidad_min'
    },
    cantidadMax: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'cantidad_max'
    },
    precioUnitario: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
      field: 'precio_unitario'
    },
    monedaFiat: {
      type: DataTypes.STRING(3),
      allowNull: false,
      field: 'moneda_fiat'
    },
    condicionesAdicionales: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'condiciones_adicionales'
    },
    activa: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'OfertaP2P',
    tableName: 'ofertas_p2p',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return OfertaP2P;
}

module.exports = initOfertaP2P;