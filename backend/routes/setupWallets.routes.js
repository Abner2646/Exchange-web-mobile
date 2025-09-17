const express = require('express');
const router = express.Router();
const setupController = require('../controllers/setupWallets.controller');
const { authenticateToken } = require('../middleware/authMiddleware');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware');

// 1. VERIFICAR ESTADO DEL SETUP
router.get('/status', /*process.env.NODE_ENV === 'development' ? [] : [authenticateToken, isAdmin],*/ setupController.checkSetupStatus);

// 2. EJECUTAR SETUP INICIAL (BTC generada, ETH desde .env, BNB generada)
router.post('/initialize', authenticateToken, /*isSuperAdmin,*/ setupController.executeCompleteSetup);
// JSON opcionales: Para forzar recreación: {"force": true}

// 3. CREAR WALLET INDIVIDUAL (busca criptomoneda existente por symbol)
//router.post('/create-wallet', authenticateToken, /*isSuperAdmin,*/ setupController.createSingleWallet);
// JSON requerido: {"symbol": "BTC"} o {"symbol": "ETH"} o {"symbol": "BNB"}

// 4. RESET COMPLETO - PELIGROSO
//router.post('/reset', authenticateToken, /*isSuperAdmin,*/ setupController.resetSetup);
// JSON requerido: {"confirmReset": "YES_DELETE_ALL_WALLETS"}

// 5. CREAR CRIPTOMONEDA ETH (si no existe)
//router.post('/create-eth-crypto', authenticateToken, /*isSuperAdmin,*/ setupController.createETHCrypto);

// 6. INSERTAR WALLET MANUALMENTE red ETH (para cualquier token ERC-20)
//router.post('/create-erc20-wallet', authenticateToken, /*isSuperAdmin,*/ setupController.createERC20WalletForCrypto);
// JSON requerido (MANTIENE MÉTODO ORIGINAL - datos en body):
/* Para cualquier ERC-20:
{
  "criptomonedaId": "uuid-del-token",
  "mnemonic": "mis doce palabras del mnemonic", 
  "privateKey": "0x-clave-privada",
  "address": "0x-direccion-publica"
}
*/

// 7. DIAGNÓSTICO SIMPLE
//router.get('/diagnostico', authenticateToken, /*isAdmin,*/ setupController.diagnostico);

module.exports = router;