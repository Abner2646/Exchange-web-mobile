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

// Registro de usuario
router.post('/register', usuarioController.registerUsuario); //Bien

// Login con credenciales
router.post('/login', usuarioController.loginUsuario); //Bien

// Login con Google
router.post('/login/google', usuarioController.loginWithGoogle); //Cuando haga el frontend

// Logout
//router.post('/logout', authenticateToken, usuarioController.logout); //No funciona, sigue activo el token

// Renovar token
//router.post('/refresh-token', authenticateToken, usuarioController.renewToken);

// --------------------- RUTAS DE PERFIL PERSONAL --------------------- //

// Obtener mi perfil
router.get('/me', authenticateToken, usuarioController.getMyProfile); // Bien

// Actualizar mi perfil (Username y pais)
router.put('/me', authenticateToken, usuarioController.updateMyProfile); //Bien

// Cambiar mi contraseña. Parametros (currentPassword y newPassword)
router.patch('/me/change-password', authenticateToken, usuarioController.changePassword); //Bien

// Solicitar verificación KYC
router.post('/me/kyc-request', authenticateToken, usuarioController.requestKYCVerification); //Cuando haga el front y vea que api uso

// Obtener mi volumen diario
router.get('/me/daily-volume', authenticateToken, usuarioController.getDailyVolume); //Cuando haga la entidad "TransaccionP2P"

// Verificar mi límite de transacción
//router.get('/me/transaction-limit', authenticateToken, usuarioController.checkTransactionLimit); //Ya está en la ruta GET /me el monto

// --------------------- RUTAS DE CONSULTA PÚBLICA --------------------- //

// Buscar usuarios públicamente
//router.get('/search', authenticateToken, usuarioController.searchUsuarios);

// Obtener top traders
//router.get('/top-traders', authenticateToken, usuarioController.getTopTraders);

// Obtener perfil público de usuario
router.get('/public/:id', usuarioController.getPublicProfile); //Bien (pasa que primero hay que conseguir el id)

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