/*
Retiros y depósitos con el exchange
Es el puente entre el exchange y la blockchain real! Es una entidad crítica!
*/

const { DataTypes, Model } = require('sequelize');

class TransaccionBlockchain extends Model {}

function initTransaccionBlockchain(sequelize) {
  TransaccionBlockchain.init({
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
    criptomonedaId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'criptomoneda_id'
    },
    tipo: {
      type: DataTypes.ENUM('deposito', 'retiro'),
      allowNull: false
    },
    cantidad: {
      type: DataTypes.DECIMAL(28, 8),
      allowNull: false
    },
    direccionDestino: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'direccion_destino'
    },
    direccionOrigen: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'direccion_origen'
    },
    txHash: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      field: 'tx_hash'
    },
    feeBlockchain: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: true,
      field: 'fee_blockchain'
    },
    confirmaciones: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    confirmacionesRequeridas: {
      type: DataTypes.INTEGER,
      defaultValue: 6,
      field: 'confirmaciones_requeridas'
    },
    estado: {
      type: DataTypes.ENUM('pendiente', 'procesando', 'confirmado', 'completado', 'fallido'),
      defaultValue: 'pendiente'
    },
    requiereAprobacion: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'requiere_aprobacion'
    },
    aprobadoPor: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'aprobado_por'
    },
    fechaAprobacion: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'fecha_aprobacion'
    }
  }, {
    sequelize,
    modelName: 'TransaccionBlockchain',
    tableName: 'transacciones_blockchain',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return TransaccionBlockchain;
}

module.exports = initTransaccionBlockchain;