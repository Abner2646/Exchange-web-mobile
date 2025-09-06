const { DataTypes, Model } = require('sequelize');

class OfertaMetodoPago extends Model {}

function initOfertaMetodoPago(sequelize) {
  OfertaMetodoPago.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    ofertaId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'oferta_id'
    },
    metodoPagoId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'metodo_pago_id'
    }
  }, {
    sequelize,
    modelName: 'OfertaMetodoPago',
    tableName: 'oferta_metodos_pago',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['oferta_id', 'metodo_pago_id']
      }
    ]
  });

  return OfertaMetodoPago;
}

module.exports = initOfertaMetodoPago;