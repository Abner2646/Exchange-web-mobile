// middleware/rateLimit.middleware.js

const rateLimit = require('express-rate-limit');

class RateLimitMiddleware {
  constructor() {
    this.windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000; // 15 minutos
  }

  // Rate limit general
  general = rateLimit({
    windowMs: this.windowMs,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
      success: false,
      message: 'Demasiadas solicitudes, intenta más tarde'
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  // Rate limit para retiros (más restrictivo)
  withdrawal = rateLimit({
    windowMs: this.windowMs,
    max: parseInt(process.env.RATE_LIMIT_WITHDRAWAL_MAX) || 10,
    message: {
      success: false,
      message: 'Demasiados intentos de retiro, intenta más tarde'
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  // Rate limit para administradores
  admin = rateLimit({
    windowMs: this.windowMs,
    max: parseInt(process.env.RATE_LIMIT_ADMIN_MAX) || 200,
    message: {
      success: false,
      message: 'Límite de solicitudes administrativas excedido'
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  // Rate limit para endpoints de sistema
  system = rateLimit({
    windowMs: this.windowMs,
    max: parseInt(process.env.RATE_LIMIT_SYSTEM_MAX) || 20,
    message: {
      success: false,
      message: 'Límite de operaciones de sistema excedido'
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  // Rate limit para escaneo (muy restrictivo)
  scan = rateLimit({
    windowMs: this.windowMs,
    max: parseInt(process.env.RATE_LIMIT_SCAN_MAX) || 5,
    message: {
      success: false,
      message: 'Límite de escaneos excedido'
    },
    standardHeaders: true,
    legacyHeaders: false
  });
}

module.exports = new RateLimitMiddleware();