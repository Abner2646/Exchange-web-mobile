jest.mock('../models', () => ({
  IdempotencyKey: { destroy: jest.fn().mockResolvedValue(3) },
  Sequelize: require('sequelize').Sequelize
}));

const { IdempotencyKey } = require('../models');
const job = require('../jobs/idempotencyCleanup.job');
const { Op } = require('sequelize');

test('cleanup() deletes keys older than the 24h TTL', async () => {
  const before = Date.now();
  await job.cleanup();

  expect(IdempotencyKey.destroy).toHaveBeenCalledTimes(1);
  const arg = IdempotencyKey.destroy.mock.calls[0][0];
  const cutoff = arg.where.createdAt[Op.lt].getTime();
  // cutoff is ~24h before now
  const expected = before - 24 * 60 * 60 * 1000;
  expect(Math.abs(cutoff - expected)).toBeLessThan(5000);
});
