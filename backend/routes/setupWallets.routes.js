const express = require('express');
const router = express.Router();
const setupController = require('../controllers/setupWallets.controller');
const { authenticateToken } = require('../middleware/authMiddleware');
const {  isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware');

// 1. VERIFICAR ESTADO DEL SETUP
router.get('/status', /*process.env.NODE_ENV === 'development' ? [] : [authenticateToken, isAdmin],*/ setupController.checkSetupStatus); // Bien (A pesar que de que tiene el isAdmin no lo pide!)

// 2. EJECUTAR SETUP INICIAL (Solo BTC y BNB) 
router.post('/initialize', authenticateToken, /*isSuperAdmin,*/ setupController.executeSetup); // Bien

// 3. CREAR WALLET INDIVIDUAL (BTC o BNB)
router.post('/create-wallet', authenticateToken, /*isSuperAdmin,*/ setupController.createSingleWallet);

// 4. RESET COMPLETO - PELIGROSO
router.post('/reset', authenticateToken, /*isSuperAdmin,*/ setupController.resetSetup); // Bien
//JSON: {"confirmReset":"YES_DELETE_ALL_WALLETS"}

// 5. CREAR CRIPTOMONEDA ETH (si no existe)
router.post('/create-eth-crypto', authenticateToken, /*isSuperAdmin,*/ setupController.createETHCrypto); // Bien

// 6. INSERTAR WALLET MANUALMENTE red ETH (para cualquier token ERC-20)
router.post('/create-erc20-wallet', authenticateToken, /*isSuperAdmin,*/ setupController.createERC20WalletForCrypto); // 
/*WALLET ETH:
{
  "criptomonedaId": "uuid-del-token",
  "mnemonic": "mis-12-palabras",
  "privateKey": "mi-clave-privada",
  "address": "direccion-publica",
  "xpub": "mi-xpub"
}

//USDT
{
  "criptomonedaId": "uuid-del-token",
  "mnemonic": "mis-12-palabras",
  "privateKey": "clave-privada",
  "address": "direccion-publica",
  "xpub": "mi-xpub",
}
*/

// 7. DIAGNÓSTICO SIMPLE
router.get('/diagnostico', authenticateToken, /*isAdmin,*/ setupController.diagnostico); // Bien

module.exports = router;