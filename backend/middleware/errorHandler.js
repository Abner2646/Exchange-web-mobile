// Central Express error handler. Known business errors (AppError) become a
// { error: { code, message } } response with their status. Anything else is a
// bug/unexpected failure: log it in full server-side with a correlation id, and
// return a sanitized 500 that never leaks the internal message.
const crypto = require('crypto');
const AppError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');

// eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature
module.exports = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
  }

  const requestId = crypto.randomBytes(6).toString('hex');
  console.error(`[${requestId}] Unhandled error:`, err);
  return res.status(500).json({
    error: { code: errorCodes.INTERNAL_ERROR, message: 'Internal server error', requestId },
  });
};
