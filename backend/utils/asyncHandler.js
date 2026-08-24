// Wraps an async Express route handler so a thrown error / rejected promise is
// forwarded to next() (Express 4 does not catch async rejections on its own),
// reaching the central error handler.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
