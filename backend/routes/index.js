const express = require('express');
const router = express.Router();

// Import routes
const authRoutes = require('../modules/users/auth.routes.js')
const balanceUsuarioRoutes = require('../modules/balances/userBalance.routes')
const cryptoRoutes = require('../modules/crypto/crypto.routes.js')
const direccionDepositoRoutes = require('../modules/wallets/depositAddress.routes.js')
const intercambioExchangeRoutes = require('../modules/swap/swap.routes.js')
const metodoPagoRoutes = require('./metodoPago.routes.js')
const notificacionesRoutes = require('./notificaciones.routes.js')
const ofertaMetodoPago = require('./ofertaMetodoPago.routes.js')
const ofertaP2PRoutes = require('./ofertaP2P.routes.js')
const parExchangeRoutes = require('../modules/swap/swapPair.routes.js')
const setupWalletsRoutes = require('../modules/wallets/setupWallets.routes.js')
const transaccionBlockchainRoutes = require('../modules/wallets/blockchainTransaction.routes.js')
const transaccionP2PRoutes = require('./transaccionesP2P.routes.js')
const transferRoutes = require('../modules/balances/transfer.routes')
const tradingRoutes = require('./trading.routes');
const userRoutes = require('../modules/users/user.routes.js')
const valoracionRoutes = require('./valoraciones.routes.js')
const walletMaestraRoutes = require('../modules/wallets/masterWallet.routes.js')
const businessConfigRoutes = require('../modules/config/businessConfig.routes.js')

// Derive routes
router.use('/auth', authRoutes)
router.use('/balances', balanceUsuarioRoutes)
router.use('/config', businessConfigRoutes)
router.use('/crypto', cryptoRoutes)
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
router.use('/transfer', transferRoutes)
router.use('/trading', tradingRoutes);
router.use('/user', userRoutes)
// Fix 2026-08-19 (AUDITORIA_BACKEND.md Altos #11): estaba comentada pese a
// que el modelo/controller ya estaban completos y activos en
// models/index.js — reactivada. También se corrigieron bugs reales que
// hubieran roto varios endpoints al usarse (Op/sequelize sin importar en
// el controller, y 'name'/'reputacion' en vez de 'username'/
// 'averageRating' en las queries del modelo).
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
