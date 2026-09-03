const express = require('express');
const router = express.Router();
const setupController = require('../controllers/setupWallets.controller');
const { authenticateToken } = require('../middleware/authMiddleware');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware');

/**
 * @openapi
 * /setupWallets/status:
 *   get: { tags: [Setup wallets (super admin)], summary: Estado del setup inicial de wallets, responses: { 200: { description: Estado }, 401: { $ref: '#/components/responses/Unauthorized' } } }
 * /setupWallets/initialize:
 *   post:
 *     tags: [Setup wallets (super admin)]
 *     summary: Ejecutar el setup inicial de wallets maestras (BTC/ETH/BNB)
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { force: { type: boolean, description: "PELIGROSO — recrea, puede romper ids preexistentes" } } }
 *     responses: { 200: { description: Setup ejecutado } }
 */
// 1. VERIFICAR ESTADO DEL SETUP
// Fix 2026-08-19 (AUDITORIA_BACKEND.md Altos #5): faltaba authenticateToken
// antes de isSuperAdmin — isSuperAdmin requiere req.user (lo documenta su
// propio código) y como nada lo seteaba, esta ruta devolvía 401 siempre,
// para cualquiera, incluido un super-admin real.
router.get('/status', authenticateToken, isSuperAdmin, setupController.checkSetupStatus);

// 2. EJECUTAR SETUP INICIAL (BTC generada, ETH desde .env, BNB generada)
router.post('/initialize', authenticateToken, isSuperAdmin, setupController.executeCompleteSetup);
// JSON opcionales: Para forzar recreación: {"force": true} //PELIGROSO! Podría romper los ids de criptomonedas y wallets preexistentes.

module.exports = router;