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
const metodoPagoModel = require('../modules/p2p/paymentMethod.model');
const notificacionesModel = require('../modules/notifications/notification.model');
const ofertaMetodoPagoModel = require('../modules/p2p/offerPaymentMethod.model');
const ofertaP2PModel = require('../modules/p2p/p2pOffer.model');
const parExchangeModel = require('../modules/swap/swapPair.model');
const transaccionBlockchainModel = require('../modules/wallets/blockchainTransaction.model');
const transaccionP2PModel = require('../modules/p2p/p2pTransaction.model');
const transferModel = require('../modules/balances/transfer.model')
const userModel = require('../modules/users/user.model');
const valoracionModel = require('../modules/p2p/rating.model');
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
const PaymentMethod = metodoPagoModel(sequelize);
const Notification = notificacionesModel(sequelize);
const OfferPaymentMethod = ofertaMetodoPagoModel(sequelize);
const P2POffer = ofertaP2PModel(sequelize);  
const SwapPair = parExchangeModel(sequelize);
const BlockchainTransaction = transaccionBlockchainModel(sequelize);
const P2PTransaction = transaccionP2PModel(sequelize);
const Transfer = transferModel(sequelize);
const User = userModel(sequelize);
const Rating = valoracionModel(sequelize);
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
User.hasMany(P2POffer, { foreignKey: 'userId', as: 'offers' });
P2POffer.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User puede ser comprador en transacciones P2P
User.hasMany(P2PTransaction, { foreignKey: 'buyerId', as: 'purchases' });
P2PTransaction.belongsTo(User, { foreignKey: 'buyerId', as: 'buyer' });

// User puede ser vendedor en transacciones P2P
User.hasMany(P2PTransaction, { foreignKey: 'sellerId', as: 'sales' });
P2PTransaction.belongsTo(User, { foreignKey: 'sellerId', as: 'seller' });


// User puede hacer muchos intercambios con el exchange
User.hasMany(Swap, { foreignKey: 'userId', as: 'swaps' });
Swap.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User puede evaluar a otros usuarios
User.hasMany(Rating, { foreignKey: 'raterId', as: 'ratingsGiven' });
Rating.belongsTo(User, { foreignKey: 'raterId', as: 'rater' });

// User puede ser evaluado por otros usuarios
User.hasMany(Rating, { foreignKey: 'ratedUserId', as: 'ratingsReceived' });
Rating.belongsTo(User, { foreignKey: 'ratedUserId', as: 'ratedUser' });

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
Crypto.hasMany(P2POffer, { foreignKey: 'cryptoId', as: 'offers' });
P2POffer.belongsTo(Crypto, { foreignKey: 'cryptoId', as: 'crypto' });

// Crypto puede estar en muchas transacciones P2P
Crypto.hasMany(P2PTransaction, { foreignKey: 'cryptoId', as: 'p2pTransactions' });
P2PTransaction.belongsTo(Crypto, { foreignKey: 'cryptoId', as: 'crypto' });

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
P2POffer.hasMany(P2PTransaction, { foreignKey: 'offerId', as: 'transactions' });
P2PTransaction.belongsTo(P2POffer, { foreignKey: 'offerId', as: 'offer' });


// Oferta P2P puede tener muchos métodos de pago (relación many-to-many)
P2POffer.belongsToMany(PaymentMethod, { 
  through: OfferPaymentMethod, 
  foreignKey: 'offerId', 
  otherKey: 'paymentMethodId',
  as: 'paymentMethods' 
});
PaymentMethod.belongsToMany(P2POffer, { 
  through: OfferPaymentMethod, 
  foreignKey: 'paymentMethodId', 
  otherKey: 'offerId',
  as: 'offers' 
});

// Relaciones directas para la tabla intermedia
P2POffer.hasMany(OfferPaymentMethod, { foreignKey: 'offerId', as: 'assignedPaymentMethods' });
OfferPaymentMethod.belongsTo(P2POffer, { foreignKey: 'offerId', as: 'offer' });

PaymentMethod.hasMany(OfferPaymentMethod, { foreignKey: 'paymentMethodId', as: 'assignedOffers' });
OfferPaymentMethod.belongsTo(PaymentMethod, { foreignKey: 'paymentMethodId', as: 'paymentMethod' });

// Transacción P2P puede usar un método de pago específico
PaymentMethod.hasMany(P2PTransaction, { foreignKey: 'paymentMethodId', as: 'transactions' });
P2PTransaction.belongsTo(PaymentMethod, { foreignKey: 'paymentMethodId', as: 'paymentMethod' });

// Fix 2026-08-19 (AUDITORIA_BACKEND.md Altos #11): estas dos líneas
// habían quedado atrapadas dentro del mismo bloque comentado que las
// asociaciones de Reclamo (que sí es código muerto) — pero Rating no
// lo es, está active. Sin esto, cualquier función de valoracion.model.js
// que usa `association: 'transaction'` (getById, getAll, y varias más)
// tiraba "Association with alias 'transaction' does not exist on
// Rating". No estaba en la auditoría original; apareció al escribir
// el test de integración de este mismo fix.
// Transacción P2P puede tener muchas valoraciones
P2PTransaction.hasMany(Rating, { foreignKey: 'p2pTransactionId', as: 'ratings' });
Rating.belongsTo(P2PTransaction, { foreignKey: 'p2pTransactionId', as: 'transaction' });


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
  PaymentMethod,
  Notification,
  OfferPaymentMethod,
  P2POffer,
  SwapPair,
  BlockchainTransaction,
  P2PTransaction,
  Transfer,
  User,
  Rating,
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