// modules/events/outbox.model.js
const initOutboxEvent = require('./outbox.entity');

function createOutboxEventModel(sequelize) {
  return initOutboxEvent(sequelize);
}

module.exports = createOutboxEventModel;
