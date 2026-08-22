const initIdempotencyKey = require('./entities/idempotencyKey.entity');

module.exports = (sequelize) => initIdempotencyKey(sequelize);
