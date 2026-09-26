const express = require('express');
const router = express.Router();

// Import routes
const authRoutes = require('../modules/users/auth.routes.js')
const balanceUsuarioRoutes = require('../modules/balances/userBalance.routes')
const cryptoRoutes = require('../modules/crypto/crypto.routes.js')
const direccionDepositoRoutes = require('../modules/wallets/depositAddress.routes.js')
const intercambioExchangeRoutes = require('../modules/swap/swap.routes.js')
const metodoPagoRoutes = require('../modules/p2p/paymentMethod.routes.js')
const notificacionesRoutes = require('../modules/notifications/notification.routes.js')
const ofertaMetodoPago = require('../modules/p2p/offerPaymentMethod.routes.js')
const ofertaP2PRoutes = require('../modules/p2p/p2pOffer.routes.js')
const parExchangeRoutes = require('../modules/swap/swapPair.routes.js')
const setupWalletsRoutes = require('../modules/wallets/setupWallets.routes.js')
const transaccionBlockchainRoutes = require('../modules/wallets/blockchainTransaction.routes.js')
const transaccionP2PRoutes = require('../modules/p2p/p2pTransaction.routes.js')
const transferRoutes = require('../modules/balances/transfer.routes')
const tradingRoutes = require('../modules/trading/trading.routes');
const userRoutes = require('../modules/users/user.routes.js')
const valoracionRoutes = require('../modules/p2p/rating.routes.js')
const walletMaestraRoutes = require('../modules/wallets/masterWallet.routes.js')
const businessConfigRoutes = require('../modules/config/businessConfig.routes.js')
const amlRoutes = require('../modules/aml/aml.routes.js')
const referralsRoutes = require('../modules/referrals/referrals.routes.js')
const launchpadRoutes = require('../modules/launchpad/launchpad.routes.js')
const kycRoutes = require('../modules/kyc/kyc.routes.js')
const governanceRoutes = require('../modules/governance/governance.routes.js')

// Wire the large-withdrawal dual-control executor + compensator into the Maker-Checker engine at
// boot: a checker's approval of a `large_withdrawal_release` action releases the held withdrawal,
// and a rejection/expiry cancels it and refunds the user's blocked funds (no stranded hold).
require('../modules/wallets/withdrawalDualControl.service').register()

// Same for large presale resolutions: a checker's approval of `large_presale_resolve` settles the
// held presale (control parity with large withdrawals — no single-operator bulk settlement).
require('../modules/launchpad/launchpad.service').register()

// Derive routes
router.use('/auth', authRoutes)
router.use('/balances', balanceUsuarioRoutes)
router.use('/aml', amlRoutes)
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
router.use('/referrals', referralsRoutes)
router.use('/launchpad', launchpadRoutes)
router.use('/kyc', kycRoutes)
router.use('/governance', governanceRoutes)
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
