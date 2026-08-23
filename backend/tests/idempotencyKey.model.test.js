// backend/tests/idempotencyKey.model.test.js
const { Sequelize } = require('sequelize');
const initIdempotencyKey = require('../models/entities/idempotencyKey.entity');

// Non-connecting instance: .init() only defines the model, no DB round-trip.
const sequelize = new Sequelize('postgres://user:pass@localhost:5432/none', { logging: false });
const IdempotencyKey = initIdempotencyKey(sequelize);

describe('IdempotencyKey entity', () => {
  test('has the expected attributes and table name', () => {
    const attrs = IdempotencyKey.getAttributes();
    expect(Object.keys(attrs)).toEqual(
      expect.arrayContaining(['userId', 'idempotencyKey', 'requestHash', 'status', 'responseStatusCode', 'responseBody'])
    );
    expect(IdempotencyKey.tableName).toBe('idempotency_keys');
    expect(attrs.status.type.values).toEqual(['in_progress', 'completed']);
  });

  test('declares a unique index on (user_id, idempotency_key)', () => {
    const indexes = IdempotencyKey.options.indexes || [];
    const unique = indexes.find(i => i.unique);
    expect(unique.fields).toEqual(['user_id', 'idempotency_key']);
  });
});
