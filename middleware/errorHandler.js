/**
 * Global error handler middleware
 * Catches all errors thrown by route handlers and returns a JSON response
 */
export const errorHandler = (err, req, res, next) => {
  // Log the full error stack to console
  console.error('Error stack:', err.stack);

  // Determine status code - default to 500
  const statusCode = err.statusCode || 500;

  // Return error response without exposing stack trace
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal server error',
  });
};

export default errorHandler;
