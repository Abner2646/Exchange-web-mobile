const { DataTypes, Model } = require('sequelize');

// Radar #13 — configuración de NEGOCIO como dato en BBDD (no env ni hardcode).
// Key-value para parámetros globales de política de negocio que no tienen una
// entidad propia (ej. confirmaciones requeridas por network, thresholds AML, mínimos
// de operación). Lo que ya vive en una entidad se queda ahí (la comisión por par
// en ParExchange, el límite diario por usuario en User) — esta tabla es para lo
// que hoy está hardcodeado/env y es política de negocio, no infra.
//
// Los SECRETOS y la config por-ambiente (claves, RPC URLs, credenciales) NO van
// acá — siguen en env (disciplina Fase 5.0).
class BusinessConfig extends Model {}

function initBusinessConfig(sequelize) {
  BusinessConfig.init({
    key: { type: DataTypes.STRING, primaryKey: true },
    // Se guarda siempre como string canónico; el type indica cómo interpretarlo.
    value: { type: DataTypes.STRING, allowNull: false },
    type: {
      type: DataTypes.ENUM('string', 'number', 'boolean', 'json'),
      allowNull: false,
      defaultValue: 'string',
    },
    category: { type: DataTypes.STRING, allowNull: true },
    description: { type: DataTypes.STRING, allowNull: true },
  }, {
    sequelize,
    modelName: 'BusinessConfig',
    tableName: 'business_config',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });
  return BusinessConfig;
}

module.exports = initBusinessConfig;
