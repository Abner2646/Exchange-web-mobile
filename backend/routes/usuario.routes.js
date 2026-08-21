// routes/usuario.routes.js
const { Router } = require('express');
const router = Router();

// Middleware de autenticación y autorización
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware.js');

// Rate Limiters
const {
  registerLimiter,
  loginLimiter,
  googleLoginLimiter,
  verifyEmailCodeLimiter,
  resendVerificationEmailLimiter,
  forgotPasswordLimiter,
  verifyResetCodeLimiter,
  resetPasswordLimiter,
  verify2FALimiter,
  resend2FALimiter,
  changePasswordLimiter
} = require('../middleware/rateLimiters');

// Validación
const { joiValidate } = require('../middleware/joiValidate.middleware');
const { LoginSchema } = require('../schemas/login.schema');

// Controlador
const usuarioController = require('../controllers/usuario.controller.js');

// =====================================================================
// RUTAS DE AUTENTICACIÓN
// =====================================================================

/**
 * POST /register
 * Registro de usuario (devuelve token temporal)
 * Rate Limit: 3 intentos/hora por IP
 */
router.post('/register', 
  registerLimiter,
  usuarioController.registerUsuario
);

/**
 * POST /login
 * Login paso 1 (credenciales, puede requerir 2FA)
 * Rate Limit: 5 intentos/15min por email
 */
router.post('/login',
  loginLimiter,
  joiValidate(LoginSchema.login),
  usuarioController.loginStep1
);

/**
 * POST /login/google
 * Login con Google OAuth
 * Rate Limit: 10 intentos/15min por IP
 */
router.post('/login/google', 
  googleLoginLimiter,
  usuarioController.loginWithGoogle
);

/**
 * POST /logout
 * Cerrar sesión (requiere autenticación)
 */
router.post('/logout', 
  authenticateToken,
  usuarioController.logout
);

// =====================================================================
// RUTAS DE VERIFICACIÓN DE EMAIL
// =====================================================================

/**
 * POST /verify-email
 * Verificar email con código (requiere token temporal)
 * Rate Limit: 5 intentos/15min por usuario
 */
router.post('/verify-email', 
  authenticateToken,
  verifyEmailCodeLimiter,
  usuarioController.verifyEmail
);

/**
 * POST /resend-verification-email
 * Reenviar código de verificación (requiere token temporal)
 * Rate Limit: 3 intentos/hora por usuario
 */
router.post('/resend-verification-email', 
  authenticateToken,
  resendVerificationEmailLimiter,
  usuarioController.resendVerificationEmail
);

// =====================================================================
// RUTAS DE RECUPERACIÓN DE CONTRASEÑA
// =====================================================================

/**
 * POST /forgot-password
 * Solicitar código de recuperación de contraseña
 * Rate Limit: 3 intentos/15min por email
 */
router.post('/forgot-password', 
  forgotPasswordLimiter,
  usuarioController.requestPasswordReset
);

/**
 * POST /verify-reset-code
 * Verificar código de recuperación
 * Rate Limit: 5 intentos/10min por email
 */
router.post('/verify-reset-code', 
  verifyResetCodeLimiter,
  usuarioController.verifyResetCode
);

/**
 * POST /reset-password
 * Resetear contraseña con código verificado
 * Rate Limit: 3 intentos/15min por email
 */
router.post('/reset-password', 
  resetPasswordLimiter,
  usuarioController.resetPassword
);

// =====================================================================
// RUTAS DE AUTENTICACIÓN EN DOS PASOS (2FA)
// =====================================================================

/**
 * POST /verify-2fa
 * Verificar código 2FA durante login
 * Rate Limit: 5 intentos/5min por email
 */
router.post('/verify-2fa', 
  verify2FALimiter,
  usuarioController.verify2FA
);

/**
 * POST /resend-2fa
 * Reenviar código 2FA
 * Rate Limit: 5 intentos/10min por email
 */
router.post('/resend-2fa', 
  resend2FALimiter,
  usuarioController.resend2FACode
);

/**
 * PATCH /me/2fa-toggle
 * Activar/desactivar 2FA (requiere autenticación)
 */
router.patch('/me/2fa-toggle', 
  authenticateToken,
  usuarioController.toggle2FA
);

// =====================================================================
// RUTAS DE PERFIL PERSONAL
// =====================================================================

/**
 * GET /me
 * Obtener mi perfil (requiere autenticación)
 */
router.get('/me', 
  authenticateToken,
  usuarioController.getMyProfile
);

/**
 * PUT /me
 * Actualizar mi perfil (username y país)
 * Requiere autenticación
 */
router.put('/me', 
  authenticateToken,
  usuarioController.updateMyProfile
);

/**
 * PATCH /me/change-password
 * Cambiar mi contraseña
 * Rate Limit: 3 intentos/hora por usuario
 * Parámetros: currentPassword, newPassword
 */
router.patch('/me/change-password', 
  authenticateToken,
  changePasswordLimiter,
  usuarioController.changePassword
);

/**
 * POST /me/kyc-request
 * Solicitar verificación KYC
 */
router.post('/me/kyc-request', 
  authenticateToken,
  usuarioController.requestKYCVerification
);

/**
 * GET /me/daily-volume
 * Obtener mi volumen diario
 */
router.get('/me/daily-volume', 
  authenticateToken,
  usuarioController.getDailyVolume
);

// =====================================================================
// RUTAS DE CONSULTA PÚBLICA
// =====================================================================

/**
 * GET /search
 * Buscar usuarios públicamente (requiere autenticación)
 */
router.get('/search', 
  authenticateToken,
  usuarioController.searchUsuarios
);

/**
 * GET /public/:id
 * Obtener perfil público de usuario
 */
router.get('/public/:id', 
  usuarioController.getPublicProfile
);

// =====================================================================
// RUTAS CRUD BÁSICAS (ADMIN)
// =====================================================================

/**
 * GET /
 * Obtener todos los usuarios (solo admin)
 */
router.get('/', 
  authenticateToken,
  isAdmin,
  usuarioController.getUsuarios
);

/**
 * GET /:id
 * Obtener usuario por ID
 * Admin: perfil completo
 * Usuario normal: perfil público
 */
router.get('/:id', 
  authenticateToken,
  usuarioController.getUsuarioById
);

/**
 * DELETE /:id
 * Eliminar usuario (solo super_admin)
 */
router.delete('/:id', 
  authenticateToken,
  isSuperAdmin,
  usuarioController.deleteUsuario
);

// =====================================================================
// RUTAS DE GESTIÓN INDIVIDUAL (ADMIN)
// =====================================================================

/**
 * PATCH /:id/status
 * Actualizar estado de usuario (admin)
 */
router.patch('/:id/status', 
  authenticateToken,
  isAdmin,
  usuarioController.updateUsuarioStatus
);

/**
 * PATCH /:id/role
 * Actualizar rol de usuario (super_admin)
 */
router.patch('/:id/role', 
  authenticateToken,
  isSuperAdmin,
  usuarioController.updateUsuarioRole
);

/**
 * PATCH /:id/kyc
 * Actualizar KYC de usuario (admin)
 */
router.patch('/:id/kyc', 
  authenticateToken,
  isAdmin,
  usuarioController.updateUsuarioKYC
);

/**
 * PATCH /:id/daily-limit
 * Actualizar límite diario (admin)
 */
router.patch('/:id/daily-limit', 
  authenticateToken,
  isAdmin,
  usuarioController.updateDailyLimit
);

/**
 * PATCH /:id/reputation
 * Actualizar reputación de usuario (admin)
 */
router.patch('/:id/reputation', 
  authenticateToken,
  isAdmin,
  usuarioController.updateUsuarioReputation
);

// =====================================================================
// RUTAS DE CONSULTA INDIVIDUAL (ADMIN)
// =====================================================================

/**
 * GET /:id/daily-volume
 * Obtener volumen diario de usuario específico (admin)
 */
router.get('/:id/daily-volume', 
  authenticateToken,
  isAdmin,
  usuarioController.getDailyVolume
);

/**
 * GET /:id/transaction-limit
 * Verificar límite de transacción de usuario (admin)
 */
router.get('/:id/transaction-limit', 
  authenticateToken,
  isAdmin,
  usuarioController.checkTransactionLimit
);

// =====================================================================
// RUTAS ADMINISTRATIVAS
// =====================================================================

/**
 * GET /admin/stats
 * Obtener estadísticas de usuarios (admin)
 */
router.get('/admin/stats', 
  authenticateToken,
  isAdmin,
  usuarioController.getUsuariosStats
);

/**
 * POST /admin/deactivate-inactive
 * Desactivar usuarios inactivos (admin)
 */
router.post('/admin/deactivate-inactive', 
  authenticateToken,
  isAdmin,
  usuarioController.deactivateInactiveUsers
);

module.exports = router;