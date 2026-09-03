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

// Anotaciones OpenAPI del dominio Usuarios/Auth (bloque único por archivo). Los
// flujos pre-login (register/login/forgot/reset/2fa-verify) son públicos
// (security:[]); el resto requiere JWT; los de gestión son admin/super_admin.
/**
 * @openapi
 * /usuario/register:
 *   post:
 *     tags: [Usuarios / Auth]
 *     summary: Registro de usuario (devuelve token temporal para verificar email)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, username]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *               username: { type: string }
 *     responses: { 201: { description: Registrado (token temporal) }, 400: { $ref: '#/components/responses/BadRequest' } }
 * /usuario/login:
 *   post:
 *     tags: [Usuarios / Auth]
 *     summary: Login paso 1 (credenciales; puede requerir 2FA)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses: { 200: { description: JWT, o requires2FA + temporalToken }, 400: { $ref: '#/components/responses/BadRequest' } }
 * /usuario/login/google:
 *   post:
 *     tags: [Usuarios / Auth]
 *     summary: Login con Google (verifica un id_token server-side)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [idToken], properties: { idToken: { type: string } } }
 *     responses: { 200: { description: JWT }, 401: { $ref: '#/components/responses/Unauthorized' } }
 * /usuario/logout:
 *   post: { tags: [Usuarios / Auth], summary: Cerrar sesión, responses: { 200: { description: OK } } }
 * /usuario/verify-email:
 *   post:
 *     tags: [Usuarios / Auth]
 *     summary: Verificar email con código (usa el token temporal)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [codigo], properties: { codigo: { type: string } } }
 *     responses: { 200: { description: Email verificado }, 400: { $ref: '#/components/responses/BadRequest' } }
 * /usuario/resend-verification-email:
 *   post: { tags: [Usuarios / Auth], summary: Reenviar código de verificación de email, responses: { 200: { description: Reenviado } } }
 * /usuario/forgot-password:
 *   post:
 *     tags: [Usuarios / Auth]
 *     summary: Solicitar código de recuperación de contraseña (anti-enumeración)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [email], properties: { email: { type: string, format: email } } }
 *     responses: { 200: { description: Si el email existe, se envió un código } }
 * /usuario/verify-reset-code:
 *   post:
 *     tags: [Usuarios / Auth]
 *     summary: Verificar el código de recuperación
 *     security: []
 *     responses: { 200: { description: Código válido }, 400: { $ref: '#/components/responses/BadRequest' } }
 * /usuario/reset-password:
 *   post:
 *     tags: [Usuarios / Auth]
 *     summary: Resetear la contraseña con el código verificado
 *     security: []
 *     responses: { 200: { description: Contraseña actualizada }, 400: { $ref: '#/components/responses/BadRequest' } }
 * /usuario/verify-2fa:
 *   post:
 *     tags: [Usuarios / Auth]
 *     summary: Verificar el código 2FA durante el login
 *     security: []
 *     responses: { 200: { description: JWT }, 400: { $ref: '#/components/responses/BadRequest' } }
 * /usuario/resend-2fa:
 *   post: { tags: [Usuarios / Auth], summary: Reenviar el código 2FA, security: [], responses: { 200: { description: Reenviado } } }
 * /usuario/me/2fa-toggle:
 *   patch: { tags: [Usuarios / Perfil], summary: Activar/desactivar 2FA, responses: { 200: { description: OK } } }
 * /usuario/me:
 *   get: { tags: [Usuarios / Perfil], summary: Mi perfil, responses: { 200: { description: Perfil }, 401: { $ref: '#/components/responses/Unauthorized' } } }
 *   put:
 *     tags: [Usuarios / Perfil]
 *     summary: Actualizar mi perfil (username, país)
 *     responses: { 200: { description: Perfil actualizado }, 400: { $ref: '#/components/responses/BadRequest' } }
 * /usuario/me/change-password:
 *   patch:
 *     tags: [Usuarios / Perfil]
 *     summary: Cambiar mi contraseña
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [currentPassword, newPassword], properties: { currentPassword: { type: string }, newPassword: { type: string } } }
 *     responses: { 200: { description: Contraseña cambiada }, 400: { $ref: '#/components/responses/BadRequest' } }
 * /usuario/me/kyc-request:
 *   post: { tags: [Usuarios / Perfil], summary: Solicitar verificación KYC, responses: { 200: { description: Solicitud creada } } }
 * /usuario/me/daily-volume:
 *   get: { tags: [Usuarios / Perfil], summary: Mi volumen diario, responses: { 200: { description: Volumen } } }
 * /usuario/search:
 *   get:
 *     tags: [Usuarios / Perfil]
 *     summary: Buscar usuarios
 *     parameters: [{ in: query, name: q, schema: { type: string } }]
 *     responses: { 200: { description: Resultados } }
 * /usuario/public/{id}:
 *   get:
 *     tags: [Usuarios / Perfil]
 *     summary: Perfil público de un usuario
 *     security: []
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Perfil público } }
 * /usuario:
 *   get: { tags: [Usuarios - admin], summary: Listar usuarios (admin), responses: { 200: { description: Usuarios } } }
 * /usuario/{id}:
 *   get:
 *     tags: [Usuarios / Perfil]
 *     summary: Usuario por id (admin ve perfil completo; usuario normal, público)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Usuario }, 404: { $ref: '#/components/responses/BadRequest' } }
 *   delete:
 *     tags: [Usuarios - admin]
 *     summary: Eliminar usuario (super admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Eliminado } }
 * /usuario/{id}/status:
 *   patch:
 *     tags: [Usuarios - admin]
 *     summary: Actualizar estado de un usuario (admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Estado actualizado } }
 * /usuario/{id}/role:
 *   patch:
 *     tags: [Usuarios - admin]
 *     summary: Actualizar rol de un usuario (super admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Rol actualizado } }
 * /usuario/{id}/kyc:
 *   patch:
 *     tags: [Usuarios - admin]
 *     summary: Actualizar KYC de un usuario (admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: KYC actualizado } }
 * /usuario/{id}/daily-limit:
 *   patch:
 *     tags: [Usuarios - admin]
 *     summary: Actualizar el límite diario de un usuario (admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Límite actualizado } }
 * /usuario/{id}/reputation:
 *   patch:
 *     tags: [Usuarios - admin]
 *     summary: Actualizar la reputación de un usuario (admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Reputación actualizada } }
 * /usuario/{id}/daily-volume:
 *   get:
 *     tags: [Usuarios - admin]
 *     summary: Volumen diario de un usuario (admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Volumen } }
 * /usuario/{id}/transaction-limit:
 *   get:
 *     tags: [Usuarios - admin]
 *     summary: Verificar el límite de transacción de un usuario (admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Límite } }
 * /usuario/admin/stats:
 *   get: { tags: [Usuarios - admin], summary: Estadísticas de usuarios (admin), responses: { 200: { description: Stats } } }
 * /usuario/admin/deactivate-inactive:
 *   post: { tags: [Usuarios - admin], summary: Desactivar usuarios inactivos (admin), responses: { 200: { description: Desactivados } } }
 */

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