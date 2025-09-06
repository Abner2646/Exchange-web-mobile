const express = require('express');
const router = express.Router();
const setupController = require('../controllers/setupWallets.controller');
const { authenticateToken } = require('../middleware/authMiddleware');
const {  isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware');

// 1. VERIFICAR ESTADO DEL SETUP
router.get('/status', process.env.NODE_ENV === 'development' ? [] : [authenticateToken, isAdmin], setupController.checkSetupStatus); // Bien (A pesar que de que tiene el isAdmin no lo pide!)

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
  "mnemonic": "expand border garden donkey pond session keep omit elegant jump museum expire",
  "privateKey": "3fa3fee64f1e622e4ce758914a97cf07957ef04408c8a3c330b2044a74dcef87",
  "address": "0x11456B8C315b6B6662576b7B20A3bfe10b0e30eC",
  "xpub": "xpub6Bz7mamYfW4xmiqPnUqvJR45WSrnRYrDRondzg6YZuJR9zA97YqUothTg5npJN4svHZJ6GGoXF13B7uoZfGWPsdkU6nXMaEqjutozb6ChWnB"
}

//USDT
{
  "criptomonedaId": "uuid-del-token",
  "mnemonic": "expand border garden donkey pond session keep omit elegant jump museum expire",
  "privateKey": "3fa3fee64f1e622e4ce758914a97cf07957ef04408c8a3c330b2044a74dcef87",
  "address": "0x11456B8C315b6B6662576b7B20A3bfe10b0e30eC",
  "xpub": "xpub6Bz7mamYfW4xmiqPnUqvJR45WSrnRYrDRondzg6YZuJR9zA97YqUothTg5npJN4svHZJ6GGoXF13B7uoZfGWPsdkU6nXMaEqjutozb6ChWnB",
  "": ""
}
*/

// 7. DIAGNÓSTICO SIMPLE
router.get('/diagnostico', authenticateToken, /*isAdmin,*/ setupController.diagnostico); // Bien

module.exports = router;