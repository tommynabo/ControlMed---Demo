'use strict';

/**
 * Application error with HTTP status code
 */
class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
    }
}

/**
 * Express error-handling middleware.
 * Always responds with JSON.  In production, generic message for 5xx errors
 * to avoid leaking stack traces or internal details.
 */
const errorHandler = (err, req, res, _next) => {
    const status = err.statusCode || 500;
    const isProduction = process.env.NODE_ENV === 'production';

    if (status >= 500) {
        console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, err);
    }

    const message = (isProduction && status >= 500)
        ? 'Internal Server Error'
        : err.message || 'Internal Server Error';

    res.status(status).json({ error: message });
};

module.exports = { AppError, errorHandler };
