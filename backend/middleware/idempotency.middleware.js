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
    error: { code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS', message: 'A request with this Idempotency-Key is already being processed. Retry shortly.' }
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
  // Expose the claim context so a controller can finalize the key inside its own
  // DB transaction (see finalizeInTransaction). Absent when the middleware did
  // not claim (replay/short-circuit) — controllers must guard accordingly.
  req._idempotency = { where, finalized: false };

  // Capture the controller's JSON response so we can store/replay it.
  let capturedBody;
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    capturedBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    // If the controller wrote `completed` inside its transaction AND the response
    // is a success (2xx), skip: re-writing here would be the post-commit window
    // this hardening closes. But `finalized` is set BEFORE commit — if the commit
    // itself fails, the response is a 5xx and the in-tx `completed` write rolled
    // back with the money, so we must NOT skip: fall through so the 5xx path
    // releases the key (persistResult destroys it) instead of leaving it stuck
    // `in_progress` for the 90s stale window. The 4xx-cache path also runs here.
    if (req._idempotency && req._idempotency.finalized && res.statusCode < 500) return;
    persistResult(where, res.statusCode, capturedBody).catch((e) => {
      console.error('idempotency: failed to persist result:', e);
    });
  });

  next();
}

// Transactional finalize (double-spend hardening). A money-path controller calls
// this INSIDE its own DB transaction, right before commit, so that "money moved"
// and "idempotency key completed" commit atomically. Without it, the key was only
// marked completed after commit (on the response `finish` event): if the process
// died in that window, the row stayed `in_progress` and the 90s stale-reclaim
// would re-execute an operation that had actually committed — a double-spend.
// No-op when the middleware did not claim (e.g. controller unit tests without the
// middleware, or a replay that short-circuited before the controller).
async function finalizeInTransaction(req, transaction, statusCode, body) {
  const ctx = req._idempotency;
  if (!ctx) return;
  await IdempotencyKey.update(
    { status: 'completed', responseStatusCode: statusCode, responseBody: body === undefined ? null : body },
    { where: ctx.where, transaction }
  );
  ctx.finalized = true;
}

async function handle(req, res, next) {
  const key = req.get('Idempotency-Key');
  if (!key) {
    return res.status(400).json({
      error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Idempotency-Key header is required' }
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
      error: { code: 'IDEMPOTENCY_KEY_REUSED', message: 'Idempotency-Key was already used with a different request' }
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

idempotency.finalizeInTransaction = finalizeInTransaction;

module.exports = idempotency;
