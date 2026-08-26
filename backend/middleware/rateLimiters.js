// middleware/rateLimiters.js

const rateLimit = require('express-rate-limit');

// ==================== RATE LIMITERS PARA AUTENTICACIÓN ==================== //

/**
 * Rate Limiter para registro de usuarios
 * Previene creación masiva de cuentas
 * Límite: 3 registros por hora por IP
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3,
  // Integration tests hit this route many times from one IP in a single
  // process (the store is not reset by DB truncation). This flag, set only by
  // the integration test harness, bypasses the limiter there. It is never set
  // in production, so the limiter stays fully active in prod, and the unit
  // suite (authRateLimiting.test.js) does not set it either, so that test
  // still verifies real limiting.
  skip: () => process.env.DISABLE_RATE_LIMIT === 'true',
  message: {
    error: 'Demasiados intentos de registro. Intenta nuevamente en 1 hora.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Identifica por IP para evitar múltiples registros
    return `register_${req.ip}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Límite de registros excedido',
      message: 'Has excedido el límite de intentos de registro. Por favor, espera 1 hora.',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000 / 60)
    });
  }
});

/**
 * Rate Limiter para login (paso 1)
 * Previene ataques de fuerza bruta
 * Límite: 5 intentos cada 15 minutos por email
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,
  // Integration tests POST { emailOrUsername }, so the keyGenerator below falls
  // back to a single per-IP key and the in-memory counter (not reset by
  // resetDb) saturates as the auth suite grows. Same integration-only bypass as
  // registerLimiter — never set in production, and the unit config does not load
  // the setup file that sets it, so authRateLimiting.test.js still verifies real
  // limiting.
  skip: () => process.env.DISABLE_RATE_LIMIT === 'true',
  message: {
    error: 'Demasiados intentos de login. Intenta nuevamente en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const identifier = req.body.email?.toLowerCase()?.trim() || req.body.username?.toLowerCase()?.trim();
    if (identifier) {
      return `login_${identifier}`;
    }
    return `login_${req.ip}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiados intentos de inicio de sesión',
      message: 'Por seguridad, espera 15 minutos antes de intentar nuevamente',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000 / 60)
    });
  }
});

/**
 * Rate Limiter para login con Google
 * Límite: 10 intentos cada 15 minutos por IP
 */
const googleLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  message: {
    error: 'Demasiados intentos de login con Google.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `google_login_${req.ip}`,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiados intentos de inicio de sesión con Google',
      message: 'Espera 15 minutos antes de intentar nuevamente',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000 / 60)
    });
  }
});

// ==================== RATE LIMITERS PARA VERIFICACIÓN DE EMAIL ==================== //

/**
 * Rate Limiter para verificar código de email
 * Previene intentos de adivinar códigos
 * Límite: 5 intentos cada 15 minutos
 */
const verifyEmailCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,
  message: {
    error: 'Demasiados intentos de verificación.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Usuario autenticado: usa su ID
    if (req.user?.id) {
      return `verify_email_${req.user.id}`;
    }
    // Fallback a IP
    return `verify_email_${req.ip}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiados intentos de verificación de email',
      message: 'Espera 15 minutos antes de intentar nuevamente',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000 / 60)
    });
  }
});

/**
 * Rate Limiter para reenvío de código de verificación de email
 * Usuario autenticado que necesita reenviar código
 * Límite: 3 intentos cada hora
 */
const resendVerificationEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3,
  message: {
    error: 'Demasiados intentos de reenvío.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user?.id) {
      return `resend_verify_${req.user.id}`;
    }
    return `resend_verify_${req.ip}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Has excedido el límite de reenvíos de email de verificación',
      message: 'Por favor, espera 1 hora antes de solicitar otro código',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000 / 60)
    });
  }
});

// ==================== RATE LIMITERS PARA RECUPERACIÓN DE CONTRASEÑA ==================== //

/**
 * Rate Limiter para solicitud de código de recuperación
 * Usuario NO autenticado, identifica por email
 * Límite: 3 intentos cada 15 minutos
 */
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 3,
  message: {
    error: 'Demasiados intentos de recuperación.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body.email?.toLowerCase()?.trim();
    if (email) {
      return `forgot_pwd_${email}`;
    }
    return `forgot_pwd_${req.ip}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Has excedido el límite de solicitudes de recuperación de contraseña',
      message: 'Por seguridad, espera 15 minutos antes de intentar nuevamente',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000 / 60)
    });
  }
});

/**
 * Rate Limiter para verificar código de recuperación
 * Previene intentos de adivinar códigos
 * Límite: 5 intentos cada 10 minutos
 */
const verifyResetCodeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 5,
  message: {
    error: 'Demasiados intentos de verificación.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body.email?.toLowerCase()?.trim();
    if (email) {
      return `verify_reset_${email}`;
    }
    return `verify_reset_${req.ip}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiados intentos de verificación de código',
      message: 'Espera 10 minutos antes de intentar nuevamente',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000 / 60)
    });
  }
});

/**
 * Rate Limiter para resetear contraseña
 * Límite: 3 intentos cada 15 minutos
 */
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 3,
  message: {
    error: 'Demasiados intentos de reseteo de contraseña.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body.email?.toLowerCase()?.trim();
    if (email) {
      return `reset_pwd_${email}`;
    }
    return `reset_pwd_${req.ip}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiados intentos de cambio de contraseña',
      message: 'Espera 15 minutos antes de intentar nuevamente',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000 / 60)
    });
  }
});

// ==================== RATE LIMITERS PARA 2FA ==================== //

/**
 * Rate Limiter para verificar código 2FA durante login
 * Límite: 5 intentos cada 5 minutos
 */
const verify2FALimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 5,
  message: {
    error: 'Demasiados intentos de código 2FA.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body.email?.toLowerCase()?.trim();
    if (email) {
      return `verify_2fa_${email}`;
    }
    if (req.body.sessionId) {
      return `verify_2fa_session_${req.body.sessionId}`;
    }
    return `verify_2fa_${req.ip}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiados intentos de código 2FA',
      message: 'Espera 5 minutos antes de intentar nuevamente',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000 / 60)
    });
  }
});

/**
 * Rate Limiter para reenvío de código 2FA
 * Límite: 5 intentos cada 10 minutos
 */
const resend2FALimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 5,
  message: {
    error: 'Demasiados intentos de reenvío de código 2FA.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body.email?.toLowerCase()?.trim();
    if (email) {
      return `resend_2fa_${email}`;
    }
    if (req.body.sessionId) {
      return `resend_2fa_session_${req.body.sessionId}`;
    }
    return `resend_2fa_${req.ip}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Has excedido el límite de reenvíos de código 2FA',
      message: 'Espera 10 minutos antes de solicitar otro código',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000 / 60)
    });
  }
});

// ==================== RATE LIMITERS PARA PERFIL ==================== //

/**
 * Rate Limiter para cambio de contraseña
 * Usuario autenticado cambiando su contraseña
 * Límite: 3 intentos cada hora
 */
const changePasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3,
  message: {
    error: 'Demasiados intentos de cambio de contraseña.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user?.id) {
      return `change_pwd_${req.user.id}`;
    }
    return `change_pwd_${req.ip}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiados intentos de cambio de contraseña',
      message: 'Espera 1 hora antes de intentar nuevamente',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000 / 60)
    });
  }
});

/**
 * OPCIONAL: Rate Limiter general para rutas de autenticación
 * Límite global para prevenir ataques masivos
 * Límite: 30 requests por hora a rutas de auth
 */
const generalAuthLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 30,
  message: {
    error: 'Demasiadas solicitudes de autenticación.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `auth_global_${req.ip}`,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Límite de solicitudes excedido',
      message: 'Has realizado demasiadas solicitudes. Espera 1 hora.',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000 / 60)
    });
  }
});

module.exports = {
  // Autenticación
  registerLimiter,
  loginLimiter,
  googleLoginLimiter,
  
  // Verificación de Email
  verifyEmailCodeLimiter,
  resendVerificationEmailLimiter,
  
  // Recuperación de Contraseña
  forgotPasswordLimiter,
  verifyResetCodeLimiter,
  resetPasswordLimiter,
  
  // 2FA
  verify2FALimiter,
  resend2FALimiter,
  
  // Perfil
  changePasswordLimiter,
  
  // General (opcional)
  generalAuthLimiter
};