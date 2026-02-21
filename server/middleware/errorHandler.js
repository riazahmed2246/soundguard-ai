/**
 * Global Express error handler
 * Must be the last middleware registered in server.js  (app.use(errorHandler))
 * Catches anything passed via next(err) from any route or controller.
 */
const errorHandler = (err, req, res, _next) => {
  const statusCode = err.statusCode || err.status || 500;

  // Log full stack in development, just the message in production
  if (process.env.NODE_ENV !== 'production') {
    console.error('[errorHandler]', err.stack || err.message);
  } else {
    console.error('[errorHandler]', err.message);
  }

  // Mongoose validation error  →  400
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors:  messages,
    });
  }

  // Mongoose bad ObjectId  →  400
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(400).json({
      success: false,
      message: `Invalid ID format: ${err.value}`,
    });
  }

  // Mongoose duplicate key  →  409
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      message: `Duplicate value for ${field}.`,
    });
  }

  // Default fallback
  return res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error.',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

module.exports = errorHandler;