const express = require('express');
const router = express.Router();

// Import routes
const authRoutes = require('./auth.routes.js')
const balanceUsuarioRoutes = require('./balanceUsuario.routes.js')
const criptomonedaRoutes = require('./criptomoneda.routes.js')
const direccionDepositoRoutes = require('./direccionDeposito.routes.js')
const intercambioExchangeRoutes = require('./intercambioExchange.routes.js')
const metodoPagoRoutes = require('./metodoPago.routes.js')
const notificacionesRoutes = require('./notificaciones.routes.js')
const ofertaMetodoPago = require('./ofertaMetodoPago.routes.js')
const ofertaP2PRoutes = require('./ofertaP2P.routes.js')
const parExchangeRoutes = require('./parExchange.routes.js')
const setupWalletsRoutes = require('./setupWallets.routes.js')
const transaccionBlockchainRoutes = require('./transaccionBlockchain.routes.js')
const transaccionP2PRoutes = require('./transaccionesP2P.routes.js')
const transferencia = require('./transferencia.routes.js')
const tradingRoutes = require('./trading.routes');
const usuarioRoutes = require('./usuario.routes.js')
const valoracionRoutes = require('./valoraciones.routes.js')
const walletMaestraRoutes = require('./walletMaestra.routes.js')
const configuracionNegocioRoutes = require('./configuracionNegocio.routes.js')

// Derive routes
router.use('/auth', authRoutes)
router.use('/balances', balanceUsuarioRoutes)
router.use('/config', configuracionNegocioRoutes)
router.use('/criptomoneda', criptomonedaRoutes)
router.use('/direccionDeposito', direccionDepositoRoutes)
router.use('/intercambioExchange', intercambioExchangeRoutes)
router.use('/metodoPago', metodoPagoRoutes)
router.use('/notificaciones', notificacionesRoutes)
router.use('/ofertaMetodoPago', ofertaMetodoPago) 
router.use('/ofertaP2P', ofertaP2PRoutes)
router.use('/parExchange', parExchangeRoutes)
router.use('/setupWallets', setupWalletsRoutes)
router.use('/transaccionBlockchain', transaccionBlockchainRoutes)
router.use('/transaccionP2P', transaccionP2PRoutes)
router.use('/transferencia', transferencia)
router.use('/trading', tradingRoutes);
router.use('/usuario', usuarioRoutes)
// Fix 2026-08-19 (AUDITORIA_BACKEND.md Altos #11): estaba comentada pese a
// que el modelo/controller ya estaban completos y activos en
// models/index.js — reactivada. También se corrigieron bugs reales que
// hubieran roto varios endpoints al usarse (Op/sequelize sin importar en
// el controller, y 'nombre'/'reputacion' en vez de 'username'/
// 'reputacionPromedio' en las queries del modelo).
router.use('/valoracion', valoracionRoutes)
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
