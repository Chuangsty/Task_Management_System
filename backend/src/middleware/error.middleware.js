// When route doesn't exist / matches the URL
export function notFoundHandler(err, req, res, next) {
  const status = err.status || 404;

  res.status(status).json({
    error: {
      code: err.code || status,
      message: err.message || "Route not found",
      details: err.details || null,
    },
  });
}

// Central error handler
export function errorHandler(err, req, res, next) {
  const status = err.status || 500;

  res.status(status).json({
    error: {
      code: err.code || status,
      message: err.message || "Server error",
      details: err.details || null,
    },
  });
}
