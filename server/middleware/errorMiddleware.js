// File: server/middleware/errorMiddleware.js

/**
 * notFound — 404 handler for unmatched routes.
 * Must be placed AFTER all valid route declarations.
 */
const notFound = (req, res, next) => {
  const error = new Error(`Route Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/**
 * errorHandler — global error handling middleware.
 * Catches errors forwarded via next(error) from anywhere in the stack.
 * Returns a structured JSON error response.
 *
 * In production the stack trace is omitted for security.
 */
const errorHandler = (err, req, res, next) => {
  // Mongoose CastError (invalid ObjectId) → 400
  if (err.name === "CastError" && err.kind === "ObjectId") {
    res.status(400).json({
      success: false,
      message: "Invalid resource ID format.",
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
    return;
  }

  // Mongoose ValidationError → 400
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors: messages,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
    return;
  }

  // Mongoose duplicate key error (E11000) → 409
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    res.status(409).json({
      success: false,
      message: `Duplicate value: a record with this ${field} already exists.`,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
    return;
  }

  // Default — use status already set on res, or fall back to 500
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export { notFound, errorHandler };
