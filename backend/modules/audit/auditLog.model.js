// modules/audit/auditLog.model.js
const initAuditLog = require('./auditLog.entity');

function createAuditLogModel(sequelize) {
  return initAuditLog(sequelize);
}

module.exports = createAuditLogModel;
