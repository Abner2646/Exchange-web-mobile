// routes/usuario.routes.js
const { Router } = require('express');
const router = Router();

// Middleware
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware.js');
// Importa el controlador
const usuarioController = require('../controllers/usuario.controller.js');

// --------------------- RUTAS DE AUTENTICACIÓN --------------------- //

// Verificar disponibilidad de email
//router.get('/check-email', usuarioController.checkEmailAvailability);

// Verificar disponibilidad de username  
//router.get('/check-username', usuarioController.checkUsernameAvailability);

// Registro de usuario (devuelve token temporal)
router.post('/register', usuarioController.registerUsuario);

// Login con Google
router.post('/login/google', usuarioController.loginWithGoogle);

// Logout
router.post('/logout', authenticateToken, usuarioController.logout);

// Renovar token
//router.post('/refresh-token', authenticateToken, usuarioController.renewToken);

// --------------------- RUTAS DE VERIFICACIÓN DE EMAIL --------------------- //

// ⚠️ CAMBIO: Ahora requiere authenticateToken (con token temporal)
// Verificar email con código
router.post('/verify-email', authenticateToken, usuarioController.verifyEmail);

// ⚠️ CAMBIO: Ahora requiere authenticateToken (con token temporal)
// Reenviar código de verificación
router.post('/resend-verification-email', authenticateToken, usuarioController.resendVerificationEmail);

// --------------------- RUTAS DE RECUPERACIÓN DE CONTRASEÑA --------------------- //

// Solicitar código de recuperación de contraseña
router.post('/forgot-password', usuarioController.requestPasswordReset);

// Verificar código de recuperación
router.post('/verify-reset-code', usuarioController.verifyResetCode);

// Resetear contraseña con código
router.post('/reset-password', usuarioController.resetPassword);

// --------------------- RUTAS DE AUTENTICACIÓN EN DOS PASOS --------------------- //

// Login paso 1 (solo credenciales, puede requerir 2FA)
router.post('/login', usuarioController.loginStep1);

// Verificar código 2FA durante login
router.post('/verify-2fa', usuarioController.verify2FA);

// Reenviar código 2FA
router.post('/resend-2fa', usuarioController.resend2FACode);

// Activar/desactivar 2FA
router.patch('/me/2fa-toggle', authenticateToken, usuarioController.toggle2FA);

// --------------------- RUTAS DE PERFIL PERSONAL --------------------- //

// Obtener mi perfil
router.get('/me', authenticateToken, usuarioController.getMyProfile);

// Actualizar mi perfil (Username y pais)
router.put('/me', authenticateToken, usuarioController.updateMyProfile);

// Cambiar mi contraseña. Parametros (currentPassword y newPassword)
router.patch('/me/change-password', authenticateToken, usuarioController.changePassword);

// Solicitar verificación KYC
router.post('/me/kyc-request', authenticateToken, usuarioController.requestKYCVerification);

// Obtener mi volumen diario
router.get('/me/daily-volume', authenticateToken, usuarioController.getDailyVolume);

// --------------------- RUTAS DE CONSULTA PÚBLICA --------------------- //

// Buscar usuarios públicamente
router.get('/search', authenticateToken, usuarioController.searchUsuarios);

// Obtener perfil público de usuario
router.get('/public/:id', usuarioController.getPublicProfile);

// --------------------- RUTAS CRUD BÁSICAS --------------------- //

// Obtener todos los usuarios (admin)
router.get('/', authenticateToken, isAdmin, usuarioController.getUsuarios);

// Obtener usuario por ID (perfil público para usuarios normales)
router.get('/:id', authenticateToken, usuarioController.getUsuarioById);

// Eliminar usuario (solo super_admin)
router.delete('/:id', authenticateToken, isSuperAdmin, usuarioController.deleteUsuario);

// --------------------- RUTAS DE GESTIÓN INDIVIDUAL --------------------- //

// Actualizar estado de usuario (admin)
router.patch('/:id/status', authenticateToken, isAdmin, usuarioController.updateUsuarioStatus);

// Actualizar rol de usuario (super_admin)
router.patch('/:id/role', authenticateToken, isSuperAdmin, usuarioController.updateUsuarioRole);

// Actualizar KYC de usuario (admin)
router.patch('/:id/kyc', authenticateToken, isAdmin, usuarioController.updateUsuarioKYC);

// Actualizar límite diario (admin)
router.patch('/:id/daily-limit', authenticateToken, isAdmin, usuarioController.updateDailyLimit);

// Actualizar reputación (sistema interno - admin)
router.patch('/:id/reputation', authenticateToken, isAdmin, usuarioController.updateUsuarioReputation);

// --------------------- RUTAS DE CONSULTA INDIVIDUAL --------------------- //

// Obtener volumen diario de usuario específico (admin)
router.get('/:id/daily-volume', authenticateToken, isAdmin, usuarioController.getDailyVolume);

// Verificar límite de transacción de usuario específico (admin)
router.get('/:id/transaction-limit', authenticateToken, isAdmin, usuarioController.checkTransactionLimit);

// --------------------- RUTAS ADMINISTRATIVAS --------------------- //

// Obtener estadísticas de usuarios (admin)
router.get('/admin/stats', authenticateToken, isAdmin, usuarioController.getUsuariosStats);

// Desactivar usuarios inactivos (admin)
router.post('/admin/deactivate-inactive', authenticateToken, isAdmin, usuarioController.deactivateInactiveUsers);

module.exports = router;