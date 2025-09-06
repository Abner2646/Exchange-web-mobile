const { DataTypes, Model } = require('sequelize');

class TransaccionP2P extends Model {}

function initTransaccionP2P(sequelize) {
  TransaccionP2P.init({
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
    compradorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'comprador_id'
    },
    vendedorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'vendedor_id'
    },
    criptomonedaId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'criptomoneda_id'
    },
    cantidad: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false
    },
    precioUnitario: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
      field: 'precio_unitario'
    },
    montoFiat: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'monto_fiat'
    },
    monedaFiat: {
      type: DataTypes.STRING(3),
      allowNull: false,
      field: 'moneda_fiat'
    },
    metodoPagoId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'metodo_pago_id'
    },
    estado: {
      type: DataTypes.ENUM('iniciada', 'cryptos_bloqueadas', 'pago_confirmado', 'completada', 'cancelada'),
      defaultValue: 'iniciada'
    },
    fechaPagoConfirmado: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'fecha_pago_confirmado'
    },
    fechaCompletada: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'fecha_completada'
    }
  }, {
    sequelize,
    modelName: 'TransaccionP2P',
    tableName: 'transacciones_p2p',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return TransaccionP2P;
}

module.exports = initTransaccionP2P;