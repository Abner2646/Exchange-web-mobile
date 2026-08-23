// backend/middleware/idempotency.middleware.js
//
// Stripe-style idempotency for money-creating POST endpoints. Requires an
// `Idempotency-Key` header. Claims the key atomically via the UNIQUE
// (user_id, idempotency_key) constraint on idempotency_keys; the first request
// runs the controller and its response is stored; retries replay it. See
// docs/superpowers/specs/2026-08-22-idempotency-design.md.
const { IdempotencyKey } = require('../models');
const { fingerprint } = require('../utils/requestFingerprint');

const STALE_MS = 90 * 1000; // in-progress rows older than this are reclaimable

function inProgress(res) {
  return res.status(409).json({
    error: 'A request with this Idempotency-Key is already being processed. Retry shortly.',
    code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS'
  });
}

async function persistResult(where, statusCode, body) {
  if (statusCode >= 500) {
    // Server errors are transient: release the key so a retry can execute.
    await IdempotencyKey.destroy({ where });
    return;
  }
  await IdempotencyKey.update(
    { status: 'completed', responseStatusCode: statusCode, responseBody: body === undefined ? null : body },
    { where }
  );
}

function runClaimed(req, res, next, where) {
  // Capture the controller's JSON response so we can store/replay it.
  let capturedBody;
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    capturedBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    persistResult(where, res.statusCode, capturedBody).catch((e) => {
      console.error('idempotency: failed to persist result:', e);
    });
  });

  next();
}

async function handle(req, res, next) {
  const key = req.get('Idempotency-Key');
  if (!key) {
    return res.status(400).json({
      error: 'Idempotency-Key header is required',
      code: 'IDEMPOTENCY_KEY_REQUIRED'
    });
  }

  const userId = req.user.id;
  const path = req.baseUrl + req.path;
  const requestHash = fingerprint(req.method, path, req.body);
  const where = { userId, idempotencyKey: key };

  try {
    await IdempotencyKey.create({ userId, idempotencyKey: key, requestHash, status: 'in_progress' });
    return runClaimed(req, res, next, where);
  } catch (err) {
    if (err.name !== 'SequelizeUniqueConstraintError') throw err;
  }

  // A row already exists for (userId, key).
  const existing = await IdempotencyKey.findOne({ where });
  if (!existing) return inProgress(res); // row vanished (cleanup race)

  if (existing.requestHash !== requestHash) {
    return res.status(422).json({
      error: 'Idempotency-Key was already used with a different request',
      code: 'IDEMPOTENCY_KEY_REUSED'
    });
  }

  if (existing.status === 'completed') {
    return res.status(existing.responseStatusCode).json(existing.responseBody);
  }

  // status === 'in_progress'
  const ageMs = Date.now() - new Date(existing.updatedAt).getTime();
  if (ageMs <= STALE_MS) return inProgress(res);

  // Stale (server likely crashed mid-request; the operation is transactional so
  // it rolled back). Reclaim atomically: only one request wins the conditional update.
  const [affected] = await IdempotencyKey.update(
    { requestHash },
    { where: { id: existing.id, status: 'in_progress' } }
  );
  if (affected === 0) return inProgress(res);
  return runClaimed(req, res, next, where);
}

async function idempotency(req, res, next) {
  try {
    await handle(req, res, next);
  } catch (err) {
    next(err);
  }
}

module.exports = idempotency;
