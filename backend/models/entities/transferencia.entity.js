const { DataTypes, Model } = require('sequelize');

class Transferencia extends Model {}

function initTransferencia(sequelize) {
  Transferencia.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    usuarioRemitenteId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'usuario_remitente_id'
    },
    usuarioDestinatarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'usuario_destinatario_id'
    },
    criptomonedaId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'criptomoneda_id'
    },
    cantidad: {
      type: DataTypes.DECIMAL(28, 8),
      allowNull: false,
      validate: {
        min: 0.00000001
      }
    },
    estado: {
      type: DataTypes.ENUM('pendiente', 'completada', 'fallida', 'cancelada'),
      defaultValue: 'pendiente'
    },
    hashTransaccion: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'hash_transaccion'
    },
    concepto: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    codigoVerificacion: {
      type: DataTypes.STRING(6),
      allowNull: true,
      field: 'codigo_verificacion'
    },
    expiracionCodigo: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expiracion_codigo'
    },
    notificacionEnviada: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'notificacion_enviada'
    }
  }, {
    sequelize,
    modelName: 'Transferencia',
    tableName: 'transferencias',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['usuario_remitente_id'] },
      { fields: ['usuario_destinatario_id'] },
      { fields: ['criptomoneda_id'] },
      { fields: ['estado'] },
      { fields: ['created_at'] },
      { fields: ['codigo_verificacion'] },
      { 
        fields: ['usuario_remitente_id', 'estado'] 
      },
      { 
        fields: ['usuario_destinatario_id', 'estado'] 
      }
    ]
  });

  return Transferencia;
}

module.exports = initTransferencia;