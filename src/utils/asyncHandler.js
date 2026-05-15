/**
 * Wraps an async Express route handler so unhandled errors are passed to next()
 * and caught by the global error handler in app.js instead of hanging silently.
 */
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error(`[route error] ${req.method} ${req.path} — ${err.message}`, err);
      next(err);
    });
  };
}

module.exports = asyncHandler;
