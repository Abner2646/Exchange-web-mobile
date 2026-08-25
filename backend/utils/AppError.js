// Structured, operational error. Thrown for known business failures; the central
// error handler turns it into a { error: { code, message } } response with the
// given status. isOperational=true distinguishes it from unexpected bugs.
class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    if (Error.captureStackTrace) Error.captureStackTrace(this, AppError);
  }
}

module.exports = AppError;
