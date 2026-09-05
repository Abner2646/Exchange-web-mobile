// backend/tests/idempotencyMiddleware.test.js
jest.mock('../models', () => {
  class SequelizeUniqueConstraintError extends Error {
    constructor() { super('unique'); this.name = 'SequelizeUniqueConstraintError'; }
  }
  return {
    IdempotencyKey: {
      create: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      destroy: jest.fn()
    },
    Sequelize: { UniqueConstraintError: SequelizeUniqueConstraintError }
  };
});

const { IdempotencyKey } = require('../models');
const idempotency = require('../middleware/idempotency.middleware');

function mockReqRes(overrides = {}) {
  const req = {
    method: 'POST',
    baseUrl: '/trading',
    path: '/orders',
    body: { side: 'buy', quantity: '1' },
    user: { id: 'user-1' },
    get: (h) => (h.toLowerCase() === 'idempotency-key' ? overrides.key : undefined),
    ...overrides.req
  };
  const res = {
    statusCode: 200,
    headers: {},
    _json: undefined,
    finishCbs: [],
    status(code) { this.statusCode = code; return this; },
    json(body) { this._json = body; this.finishCbs.forEach(cb => cb()); return this; },
    on(event, cb) { if (event === 'finish') this.finishCbs.push(cb); }
  };
  return { req, res };
}

function uniqueError() {
  const e = new Error('unique'); e.name = 'SequelizeUniqueConstraintError'; return e;
}

beforeEach(() => jest.clearAllMocks());

test('missing Idempotency-Key header -> 400, controller not called', async () => {
  const { req, res } = mockReqRes({ key: undefined });
  const next = jest.fn();
  await idempotency(req, res, next);
  expect(res.statusCode).toBe(400);
  expect(res._json.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  expect(next).not.toHaveBeenCalled();
});

test('first request claims the key, calls next, and stores the response on finish', async () => {
  const { req, res } = mockReqRes({ key: 'k1' });
  IdempotencyKey.create.mockResolvedValue({});
  const next = jest.fn(() => res.status(201).json({ ok: true }));
  await idempotency(req, res, next);
  expect(IdempotencyKey.create).toHaveBeenCalledWith(expect.objectContaining({
    userId: 'user-1', idempotencyKey: 'k1', status: 'in_progress'
  }));
  expect(next).toHaveBeenCalled();
  expect(IdempotencyKey.update).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'completed', responseStatusCode: 201, responseBody: { ok: true } }),
    { where: { userId: 'user-1', idempotencyKey: 'k1' } }
  );
});

test('replay: completed row with matching hash returns stored response, next not called', async () => {
  const { req, res } = mockReqRes({ key: 'k1' });
  IdempotencyKey.create.mockRejectedValue(uniqueError());
  IdempotencyKey.findOne.mockResolvedValue({
    // hash must match what the middleware computes for this req
    requestHash: require('../utils/requestFingerprint').fingerprint('POST', '/trading/orders', { side: 'buy', quantity: '1' }),
    status: 'completed',
    responseStatusCode: 201,
    responseBody: { ok: true }
  });
  const next = jest.fn();
  await idempotency(req, res, next);
  expect(res.statusCode).toBe(201);
  expect(res._json).toEqual({ ok: true });
  expect(next).not.toHaveBeenCalled();
});

test('same key, different body -> 422', async () => {
  const { req, res } = mockReqRes({ key: 'k1' });
  IdempotencyKey.create.mockRejectedValue(uniqueError());
  IdempotencyKey.findOne.mockResolvedValue({ requestHash: 'different', status: 'completed' });
  const next = jest.fn();
  await idempotency(req, res, next);
  expect(res.statusCode).toBe(422);
  expect(res._json.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  expect(next).not.toHaveBeenCalled();
});

test('in-progress within 90s -> 409', async () => {
  const { req, res } = mockReqRes({ key: 'k1' });
  IdempotencyKey.create.mockRejectedValue(uniqueError());
  IdempotencyKey.findOne.mockResolvedValue({
    requestHash: require('../utils/requestFingerprint').fingerprint('POST', '/trading/orders', { side: 'buy', quantity: '1' }),
    status: 'in_progress',
    updatedAt: new Date()
  });
  const next = jest.fn();
  await idempotency(req, res, next);
  expect(res.statusCode).toBe(409);
  expect(res._json.error.code).toBe('IDEMPOTENCY_REQUEST_IN_PROGRESS');
  expect(next).not.toHaveBeenCalled();
});

test('5xx response releases the key (destroy), does not store completed', async () => {
  const { req, res } = mockReqRes({ key: 'k1' });
  IdempotencyKey.create.mockResolvedValue({});
  const next = jest.fn(() => res.status(500).json({ error: 'boom' }));
  await idempotency(req, res, next);
  expect(IdempotencyKey.destroy).toHaveBeenCalledWith({ where: { userId: 'user-1', idempotencyKey: 'k1' } });
  expect(IdempotencyKey.update).not.toHaveBeenCalled();
});

test('non-unique DB error on create routes to next(err)', async () => {
  const { req, res } = mockReqRes({ key: 'k1' });
  const dbErr = new Error('connection lost');
  IdempotencyKey.create.mockRejectedValue(dbErr);
  const next = jest.fn();
  await idempotency(req, res, next);
  expect(next).toHaveBeenCalledWith(dbErr);
});

test('success path: controller finalizes in-transaction; finish handler does not double-write', async () => {
  const { req, res } = mockReqRes({ key: 'k1' });
  IdempotencyKey.create.mockResolvedValue({});
  const fakeTx = { id: 'tx-1' };
  let finalizePromise;
  const next = () => {
    finalizePromise = (async () => {
      await idempotency.finalizeInTransaction(req, fakeTx, 201, { ok: true });
      res.status(201).json({ ok: true });
    })();
  };
  await idempotency(req, res, next);
  await finalizePromise;

  // Written exactly once, inside the controller's transaction. The finish handler
  // must NOT write a second time (that post-commit write is the double-spend window).
  expect(IdempotencyKey.update).toHaveBeenCalledTimes(1);
  expect(IdempotencyKey.update).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'completed', responseStatusCode: 201, responseBody: { ok: true } }),
    expect.objectContaining({ where: { userId: 'user-1', idempotencyKey: 'k1' }, transaction: fakeTx })
  );
  expect(IdempotencyKey.destroy).not.toHaveBeenCalled();
});

test('finalize then a 5xx (commit failure) releases the key, does not leave it in_progress', async () => {
  const { req, res } = mockReqRes({ key: 'k1' });
  IdempotencyKey.create.mockResolvedValue({});
  const fakeTx = { id: 'tx-1' };
  let finalizePromise;
  const next = () => {
    finalizePromise = (async () => {
      await idempotency.finalizeInTransaction(req, fakeTx, 201, { ok: true }); // marca finalized
      res.status(500).json({ error: 'commit failed' }); // pero el commit falló → 5xx
    })();
  };
  await idempotency(req, res, next);
  await finalizePromise;

  // El write in-tx de `completed` rolleó con el commit fallido; como la respuesta
  // es 5xx, el finish handler NO saltea: libera la key (destroy) para reintento
  // inmediato, en vez de dejarla trabada 90s.
  expect(IdempotencyKey.destroy).toHaveBeenCalledWith({ where: { userId: 'user-1', idempotencyKey: 'k1' } });
});

test('finalizeInTransaction is a no-op when the middleware did not claim (req has no idempotency context)', async () => {
  const req = { user: { id: 'user-1' } };
  await idempotency.finalizeInTransaction(req, { id: 'tx-1' }, 201, { ok: true });
  expect(IdempotencyKey.update).not.toHaveBeenCalled();
});

test('stale in-progress (>90s) is reclaimed and runs the controller', async () => {
  const { req, res } = mockReqRes({ key: 'k1' });
  IdempotencyKey.create.mockRejectedValue(uniqueError());
  IdempotencyKey.findOne.mockResolvedValue({
    id: 'row-1',
    requestHash: require('../utils/requestFingerprint').fingerprint('POST', '/trading/orders', { side: 'buy', quantity: '1' }),
    status: 'in_progress',
    updatedAt: new Date(Date.now() - 91 * 1000)
  });
  IdempotencyKey.update.mockResolvedValue([1]);
  const next = jest.fn(() => res.status(201).json({ ok: true }));
  await idempotency(req, res, next);
  expect(IdempotencyKey.update).toHaveBeenCalledWith(
    { requestHash: expect.any(String) },
    { where: { id: 'row-1', status: 'in_progress' } }
  );
  expect(next).toHaveBeenCalled();
});
