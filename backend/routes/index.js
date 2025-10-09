const express = require('express');
const router = express.Router();

// Import routes
const balanceUsuarioRoutes = require('./balanceUsuario.routes.js')
//const categoriaReclamoRoutes = require('./categoriaReclamo.routes.js')
const criptomonedaRoutes = require('./criptomoneda.routes.js')
const direccionDepositoRoutes = require('./direccionDeposito.routes.js')
const intercambioExchangeRoutes = require('./intercambioExchange.routes.js')
//const logAdminRoutes = require('./logAdmin.routes.js')
//const logTransaccionRoutes = require('./logTransaccion.routes.js')
//const mensajeReclamoRoutes = require('./mensajeReclamo.routes.js')
const metodoPagoRoutes = require('./metodoPago.routes.js')
const notificacionesRoutes = require('./notificaciones.routes.js')
const ofertaMetodoPago = require('./ofertaMetodoPago.routes.js')
const ofertaP2PRoutes = require('./ofertaP2P.routes.js')
const parExchangeRoutes = require('./parExchange.routes.js')
//const reclamoRoutes = require('./reclamo.routes.js')
const setupWalletsRoutes = require('./setupWallets.routes.js')
const transaccionBlockchainRoutes = require('./transaccionBlockchain.routes.js')
const transaccionP2PRoutes = require('./transaccionesP2P.routes.js')
const transferencia = require('./transferencia.routes.js')
const usuarioRoutes = require('./usuario.routes.js')
//const valoracionRoutes = require('./valoraciones.routes.js')
const walletMaestraRoutes = require('./walletMaestra.routes.js')

// Derive routes
router.use('/balances', balanceUsuarioRoutes)
//router.use('/categoriaReclamo', categoriaReclamoRoutes)
router.use('/criptomoneda', criptomonedaRoutes)
router.use('/direccionDeposito', direccionDepositoRoutes)
router.use('/intercambioExchange', intercambioExchangeRoutes)
//router.use('/logAdmin', logAdminRoutes)
//router.use('/logTransaccion', logTransaccionRoutes)
//router.use('/mensajeReclamo', mensajeReclamoRoutes)
router.use('/metodoPago', metodoPagoRoutes)
router.use('/notificaciones', notificacionesRoutes)
router.use('/ofertaMetodoPago', ofertaMetodoPago) 
router.use('/ofertaP2P', ofertaP2PRoutes)
router.use('/parExchange', parExchangeRoutes)
//router.use('/reclamo', reclamoRoutes)
router.use('/setupWallets', setupWalletsRoutes)
router.use('/transaccionBlockchain', transaccionBlockchainRoutes)
router.use('/transaccionP2P', transaccionP2PRoutes)
router.use('/transferencia', transferencia)
router.use('/usuario', usuarioRoutes)
//router.use('/valoracion', valoracionRoutes)
router.use('/walletMaestra', walletMaestraRoutes)

// Test route
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'API working correctly',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Example route
router.get('/test', (req, res) => {
  res.json({
    message: 'Test endpoint',
    data: {
      backend: 'Express',
      database: 'PostgreSQL',
      orm: 'Sequelize'
    }
  });
});

module.exports = router;
