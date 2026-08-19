const express = require('express');
const router = express.Router();
const setupController = require('../controllers/setupWallets.controller');
const { authenticateToken } = require('../middleware/authMiddleware');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware');

// 1. VERIFICAR ESTADO DEL SETUP
router.get('/status', isSuperAdmin, /*process.env.NODE_ENV === 'development' ? [] : [authenticateToken, isAdmin],*/ setupController.checkSetupStatus);

// 2. EJECUTAR SETUP INICIAL (BTC generada, ETH desde .env, BNB generada)
router.post('/initialize', authenticateToken, isSuperAdmin, setupController.executeCompleteSetup);
// JSON opcionales: Para forzar recreación: {"force": true} //PELIGROSO! Podría romper los ids de criptomonedas y wallets preexistentes.

module.exports = router;