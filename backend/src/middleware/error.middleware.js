export function errorHandler(err, req, res, next) {
  console.error(err);

  const status = err.status || 500;

  res.status(status).json({
    error: {
      code: err.code || (status === 400 ? "BAD_REQUEST" : status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR"),
      message: err.message || (status === 400 ? "Bad request" : status === 401 ? "Unauthorized" : status === 403 ? "Forbidden" : status === 404 ? "Route not found" : "Server error"),
      details: err.details ?? null,
    },
  });
}
