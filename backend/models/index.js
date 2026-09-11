const { Sequelize } = require('sequelize');
const config = require('../config/database');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];


// Import models
const userBalanceModel = require('../modules/balances/userBalance.model');
const createBlockchainStateModel = require('../modules/wallets/blockchainState.model');
const cryptoModel = require('../modules/crypto/crypto.model.js');
const direccionDepositoModel = require('../modules/wallets/depositAddress.model');
const intercambioExchangeModel = require('../modules/swap/swap.model');
const metodoPagoModel = require('./metodoPago.model');
const notificacionesModel = require('./notificaciones.model');
const ofertaMetodoPagoModel = require('./ofertaMetodoPago.model');
const ofertaP2PModel = require('./ofertaP2P.model');
const parExchangeModel = require('../modules/swap/swapPair.model');
const transaccionBlockchainModel = require('../modules/wallets/blockchainTransaction.model');
const transaccionP2PModel = require('./transaccionesP2P.model');
const transferModel = require('../modules/balances/transfer.model')
const userModel = require('../modules/users/user.model');
const valoracionModel = require('./valoracion.model');
const walletMaestraModel = require('../modules/wallets/masterWallet.model');

// TRADING MODELS
const tradingPairModel = require('../modules/trading/tradingPair.model.js');
const orderModel = require('../modules/trading/order.model');
const tradeModel = require('../modules/trading/trade.model');
const priceCandleModel = require('../modules/trading/priceCandle.model');
const idempotencyKeyModel = require('./idempotencyKey.model');

// LEDGER (partida doble) — Radar #1 + #10
const initLedgerAccount = require('../modules/balances/ledger/ledgerAccount.entity');
const initLedgerEntry = require('../modules/balances/ledger/ledgerEntry.entity');
const initLedgerMovement = require('../modules/balances/ledger/ledgerMovement.entity');
const initLedgerBalance = require('../modules/balances/ledger/ledgerBalance.entity');

// Config de negocio (Radar #13)
const initBusinessConfig = require('../modules/config/businessConfig.entity');



// Connecting to the database
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    pool: dbConfig.pool,
    dialectOptions: dbConfig.dialectOptions
  }
);


//Initialize models
const UserBalance = userBalanceModel(sequelize);
const BlockchainState = createBlockchainStateModel(sequelize);
const Crypto = cryptoModel(sequelize);
const DepositAddress = direccionDepositoModel(sequelize);
const Swap = intercambioExchangeModel(sequelize);
const MetodoPago = metodoPagoModel(sequelize);
const Notificaciones = notificacionesModel(sequelize);
const OfertaMetodoPago = ofertaMetodoPagoModel(sequelize);
const OfertaP2P = ofertaP2PModel(sequelize);  
const SwapPair = parExchangeModel(sequelize);
const BlockchainTransaction = transaccionBlockchainModel(sequelize);
const TransaccionP2P = transaccionP2PModel(sequelize);
const Transfer = transferModel(sequelize);
const User = userModel(sequelize);
const Valoracion = valoracionModel(sequelize);
const MasterWallet = walletMaestraModel(sequelize);

// 🆕 INITIALIZE TRADING MODELS
const TradingPair = tradingPairModel(sequelize);
const Order = orderModel(sequelize);
const Trade = tradeModel(sequelize);
const PriceCandle = priceCandleModel(sequelize);
const IdempotencyKey = idempotencyKeyModel(sequelize);

// 🆕 LEDGER MODELS (partida doble)
const LedgerAccount = initLedgerAccount(sequelize);
const LedgerEntry = initLedgerEntry(sequelize);
const LedgerMovement = initLedgerMovement(sequelize);
const LedgerBalance = initLedgerBalance(sequelize);
const BusinessConfig = initBusinessConfig(sequelize);

// (Write-flip Paso B: el shim CDC balanceMirror se eliminó — todas las escrituras
// de dinero postean al ledger DIRECTO vía updateBalance/blockBalance/unblockBalance
// y el settlement de deposito/retiro. El ledger es el único escritor de dinero.)



// Relationships between tables
// ================================
// RELACIONES DE USUARIOS
// ================================

// (Paso C: User↔UserBalance se eliminó — UserBalance ya no es un modelo
// Sequelize sino una fachada del ledger; los saldos se leen de la proyección del
// ledger, no de una asociación.)

// User puede tener muchas direcciones de depósito
// Mismo bug (Críticos #9), y encima asimétrico: el belongsTo ya se había
// corregido a userId pero el hasMany inverso se había quedado en usuarioId.
User.hasMany(DepositAddress, { foreignKey: 'userId', as: 'depositAddresses' });
DepositAddress.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User puede crear muchas ofertas P2P
User.hasMany(OfertaP2P, { foreignKey: 'usuarioId', as: 'ofertas' });
OfertaP2P.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });

// User puede ser comprador en transacciones P2P
User.hasMany(TransaccionP2P, { foreignKey: 'compradorId', as: 'compras' });
TransaccionP2P.belongsTo(User, { foreignKey: 'compradorId', as: 'comprador' });

// User puede ser vendedor en transacciones P2P
User.hasMany(TransaccionP2P, { foreignKey: 'vendedorId', as: 'ventas' });
TransaccionP2P.belongsTo(User, { foreignKey: 'vendedorId', as: 'vendedor' });


// User puede hacer muchos intercambios con el exchange
User.hasMany(Swap, { foreignKey: 'userId', as: 'swaps' });
Swap.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User puede evaluar a otros usuarios
User.hasMany(Valoracion, { foreignKey: 'usuarioEvaluadorId', as: 'valoracionesDadas' });
Valoracion.belongsTo(User, { foreignKey: 'usuarioEvaluadorId', as: 'evaluador' });

// User puede ser evaluado por otros usuarios
User.hasMany(Valoracion, { foreignKey: 'usuarioEvaluadoId', as: 'valoracionesRecibidas' });
Valoracion.belongsTo(User, { foreignKey: 'usuarioEvaluadoId', as: 'evaluado' });

// User puede hacer transacciones blockchain
// Fix 2026-08-19 (AUDITORIA_BACKEND.md Críticos #9): mismo bug que arriba —
// la columna real en transacciones_blockchain es user_id, no usuarioId.
User.hasMany(BlockchainTransaction, { foreignKey: 'userId', as: 'blockchainTransactions' });
BlockchainTransaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Admin puede aprobar transacciones blockchain
User.hasMany(BlockchainTransaction, { foreignKey: 'approvedBy', as: 'approvedTransactions' });
BlockchainTransaction.belongsTo(User, { foreignKey: 'approvedBy', as: 'adminApprover' });

// 🆕 User puede crear muchas órdenes de trading
User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// 🆕 User puede ser comprador en trades
User.hasMany(Trade, { foreignKey: 'buyerId', as: 'buyTrades' });
Trade.belongsTo(User, { foreignKey: 'buyerId', as: 'buyer' });

// 🆕 User puede ser vendedor en trades
User.hasMany(Trade, { foreignKey: 'sellerId', as: 'sellTrades' });
Trade.belongsTo(User, { foreignKey: 'sellerId', as: 'seller' });

// ================================
// RELACIONES DE CRIPTOMONEDAS
// ================================

// Crypto puede tener una wallet maestra
Crypto.hasOne(MasterWallet, { foreignKey: 'cryptoId', as: 'masterWallet' });
MasterWallet.belongsTo(Crypto, { foreignKey: 'cryptoId', as: 'crypto' });

// Crypto puede tener muchas direcciones de depósito
Crypto.hasMany(DepositAddress, { foreignKey: 'cryptoId', as: 'depositAddresses' });
DepositAddress.belongsTo(Crypto, { foreignKey: 'cryptoId', as: 'crypto' });

// (Paso C: Crypto↔UserBalance se eliminó junto con la tabla balances_users.)

// Crypto puede estar en muchas ofertas P2P
Crypto.hasMany(OfertaP2P, { foreignKey: 'criptomonedaId', as: 'ofertas' });
OfertaP2P.belongsTo(Crypto, { foreignKey: 'criptomonedaId', as: 'crypto' });

// Crypto puede estar en muchas transacciones P2P
Crypto.hasMany(TransaccionP2P, { foreignKey: 'criptomonedaId', as: 'transaccionesP2P' });
TransaccionP2P.belongsTo(Crypto, { foreignKey: 'criptomonedaId', as: 'crypto' });

// Crypto puede ser base en pares de exchange
Crypto.hasMany(SwapPair, { foreignKey: 'baseCryptoId', as: 'pairsAsBase' });
SwapPair.belongsTo(Crypto, { foreignKey: 'baseCryptoId', as: 'baseCrypto' });

// Crypto puede ser quote en pares de exchange
Crypto.hasMany(SwapPair, { foreignKey: 'quoteCryptoId', as: 'pairsAsQuote' });
SwapPair.belongsTo(Crypto, { foreignKey: 'quoteCryptoId', as: 'quoteCrypto' });

// Crypto puede estar en transacciones blockchain
Crypto.hasMany(BlockchainTransaction, { foreignKey: 'cryptoId', as: 'blockchainTransactions' });
BlockchainTransaction.belongsTo(Crypto, { foreignKey: 'cryptoId', as: 'crypto' });

// 🆕 Crypto puede ser base asset en pares de trading
Crypto.hasMany(TradingPair, { foreignKey: 'baseAssetId', as: 'tradingPairsAsBase' });
TradingPair.belongsTo(Crypto, { foreignKey: 'baseAssetId', as: 'baseAsset' });

// 🆕 Crypto puede ser quote asset en pares de trading
Crypto.hasMany(TradingPair, { foreignKey: 'quoteAssetId', as: 'tradingPairsAsQuote' });
TradingPair.belongsTo(Crypto, { foreignKey: 'quoteAssetId', as: 'quoteAsset' });

// ================================
// RELACIONES DE PARES EXCHANGE
// ================================

// Par exchange puede tener muchos intercambios
SwapPair.hasMany(Swap, { foreignKey: 'pairId', as: 'swaps' });
Swap.belongsTo(SwapPair, { foreignKey: 'pairId', as: 'pair' });

// ================================
// 🆕 RELACIONES DE TRADING
// ================================

// TradingPair puede tener muchas órdenes
TradingPair.hasMany(Order, { foreignKey: 'tradingPairId', as: 'orders' });
Order.belongsTo(TradingPair, { foreignKey: 'tradingPairId', as: 'tradingPair' });

// TradingPair puede tener muchos trades
TradingPair.hasMany(Trade, { foreignKey: 'tradingPairId', as: 'trades' });
Trade.belongsTo(TradingPair, { foreignKey: 'tradingPairId', as: 'tradingPair' });

// TradingPair puede tener muchas velas de precio
TradingPair.hasMany(PriceCandle, { foreignKey: 'tradingPairId', as: 'candles' });
PriceCandle.belongsTo(TradingPair, { foreignKey: 'tradingPairId', as: 'tradingPair' });

// Order puede tener muchos trades como orden de compra
Order.hasMany(Trade, { foreignKey: 'buyOrderId', as: 'buyTrades' });
Trade.belongsTo(Order, { foreignKey: 'buyOrderId', as: 'buyOrder' });

// Order puede tener muchos trades como orden de venta
Order.hasMany(Trade, { foreignKey: 'sellOrderId', as: 'sellTrades' });
Trade.belongsTo(Order, { foreignKey: 'sellOrderId', as: 'sellOrder' });

// ================================
// RELACIONES DE WALLETS
// ================================

// Wallet maestra puede tener muchas direcciones de depósito
MasterWallet.hasMany(DepositAddress, { foreignKey: 'masterWalletId', as: 'depositAddresses' });
DepositAddress.belongsTo(MasterWallet, { foreignKey: 'masterWalletId', as: 'masterWallet' });

// ================================
// RELACIONES DE SISTEMA P2P
// ================================

// Oferta P2P puede tener muchas transacciones P2P
OfertaP2P.hasMany(TransaccionP2P, { foreignKey: 'ofertaId', as: 'transacciones' });
TransaccionP2P.belongsTo(OfertaP2P, { foreignKey: 'ofertaId', as: 'oferta' });


// Oferta P2P puede tener muchos métodos de pago (relación many-to-many)
OfertaP2P.belongsToMany(MetodoPago, { 
  through: OfertaMetodoPago, 
  foreignKey: 'ofertaId', 
  otherKey: 'metodoPagoId',
  as: 'metodosPago' 
});
MetodoPago.belongsToMany(OfertaP2P, { 
  through: OfertaMetodoPago, 
  foreignKey: 'metodoPagoId', 
  otherKey: 'ofertaId',
  as: 'ofertas' 
});

// Relaciones directas para la tabla intermedia
OfertaP2P.hasMany(OfertaMetodoPago, { foreignKey: 'ofertaId', as: 'metodosAsignados' });
OfertaMetodoPago.belongsTo(OfertaP2P, { foreignKey: 'ofertaId', as: 'oferta' });

MetodoPago.hasMany(OfertaMetodoPago, { foreignKey: 'metodoPagoId', as: 'ofertasAsignadas' });
OfertaMetodoPago.belongsTo(MetodoPago, { foreignKey: 'metodoPagoId', as: 'metodoPago' });

// Transacción P2P puede usar un método de pago específico
MetodoPago.hasMany(TransaccionP2P, { foreignKey: 'metodoPagoId', as: 'transacciones' });
TransaccionP2P.belongsTo(MetodoPago, { foreignKey: 'metodoPagoId', as: 'metodoPago' });

// Fix 2026-08-19 (AUDITORIA_BACKEND.md Altos #11): estas dos líneas
// habían quedado atrapadas dentro del mismo bloque comentado que las
// asociaciones de Reclamo (que sí es código muerto) — pero Valoracion no
// lo es, está active. Sin esto, cualquier función de valoracion.model.js
// que usa `association: 'transaccion'` (getById, getAll, y varias más)
// tiraba "Association with alias 'transaccion' does not exist on
// Valoracion". No estaba en la auditoría original; apareció al escribir
// el test de integración de este mismo fix.
// Transacción P2P puede tener muchas valoraciones
TransaccionP2P.hasMany(Valoracion, { foreignKey: 'transaccionP2PId', as: 'valoraciones' });
Valoracion.belongsTo(TransaccionP2P, { foreignKey: 'transaccionP2PId', as: 'transaccion' });


// ================================
// RELACIONES DE TRANSFERENCIAS
// ================================

// User puede ser remitente en muchas transferencias
User.hasMany(Transfer, { foreignKey: 'senderId', as: 'sentTransfers' });
Transfer.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });

// User puede ser destinatario en muchas transferencias
User.hasMany(Transfer, { foreignKey: 'recipientId', as: 'receivedTransfers' });
Transfer.belongsTo(User, { foreignKey: 'recipientId', as: 'recipient' });

// Transferencia pertenece a una criptomoneda
Crypto.hasMany(Transfer, { foreignKey: 'cryptoId', as: 'transfers' });
Transfer.belongsTo(Crypto, { foreignKey: 'cryptoId', as: 'crypto' }); // Alias único


// ================================
// RELACIONES DEL LEDGER (partida doble)
// ================================
LedgerEntry.hasMany(LedgerMovement, { foreignKey: 'entryId', as: 'movements' });
LedgerMovement.belongsTo(LedgerEntry, { foreignKey: 'entryId', as: 'entry' });
LedgerMovement.belongsTo(LedgerAccount, { foreignKey: 'accountId', as: 'account' });
LedgerAccount.hasMany(LedgerMovement, { foreignKey: 'accountId', as: 'movements' });
LedgerAccount.hasOne(LedgerBalance, { foreignKey: 'accountId', as: 'projectedBalance' });
LedgerBalance.belongsTo(LedgerAccount, { foreignKey: 'accountId', as: 'account' });



module.exports = {
  sequelize,
  Sequelize,
  UserBalance,
  BlockchainState,
  Crypto,
  DepositAddress,
  Swap,
  MetodoPago,
  Notificaciones,
  OfertaMetodoPago,
  OfertaP2P,
  SwapPair,
  BlockchainTransaction,
  TransaccionP2P,
  Transfer,
  User,
  Valoracion,
  MasterWallet,
  // 🆕 TRADING MODELS
  TradingPair,
  Order,
  Trade,
  PriceCandle,
  IdempotencyKey,
  // 🆕 LEDGER MODELS (partida doble)
  LedgerAccount,
  LedgerEntry,
  LedgerMovement,
  LedgerBalance,
  BusinessConfig,
};