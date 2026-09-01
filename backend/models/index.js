const { Sequelize } = require('sequelize');
const config = require('../config/database');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];


// Import models
const balanceUsuarioModel = require('./balanceUsuario.model');
const createBlockchainStateModel = require('./blockchainState.model');
const criptomonedaModel = require('./criptomoneda.model.js');
const direccionDepositoModel = require('./direccionDeposito.model');
const intercambioExchangeModel = require('./intercambioExchange.model');
const metodoPagoModel = require('./metodoPago.model');
const notificacionesModel = require('./notificaciones.model');
const ofertaMetodoPagoModel = require('./ofertaMetodoPago.model');
const ofertaP2PModel = require('./ofertaP2P.model');
const parExchangeModel = require('./parExchange.model');
const transaccionBlockchainModel = require('./transaccionBlockchain.model');
const transaccionP2PModel = require('./transaccionesP2P.model');
const transferenciaModel = require('./transferencia.model.js')
const usuarioModel = require('./usuario.model');
const valoracionModel = require('./valoracion.model');
const walletMaestraModel = require('./walletMaestra.model');

// TRADING MODELS
const tradingPairModel = require('./tradingPair.model.js');
const orderModel = require('./order.model');
const tradeModel = require('./trade.model');
const priceCandleModel = require('./priceCandle.model');
const idempotencyKeyModel = require('./idempotencyKey.model');

// LEDGER (partida doble) — Radar #1 + #10
const initCuentaLedger = require('./entities/cuentaLedger.entity');
const initAsientoLedger = require('./entities/asientoLedger.entity');
const initMovimientoLedger = require('./entities/movimientoLedger.entity');
const initSaldoLedger = require('./entities/saldoLedger.entity');



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
const BalanceUsuario = balanceUsuarioModel(sequelize);
const BlockchainState = createBlockchainStateModel(sequelize);
const Criptomoneda = criptomonedaModel(sequelize);
const DireccionDeposito = direccionDepositoModel(sequelize);
const IntercambioExchange = intercambioExchangeModel(sequelize);
const MetodoPago = metodoPagoModel(sequelize);
const Notificaciones = notificacionesModel(sequelize);
const OfertaMetodoPago = ofertaMetodoPagoModel(sequelize);
const OfertaP2P = ofertaP2PModel(sequelize);  
const ParExchange = parExchangeModel(sequelize);
const TransaccionBlockchain = transaccionBlockchainModel(sequelize);
const TransaccionP2P = transaccionP2PModel(sequelize);
const Transferencia = transferenciaModel(sequelize);
const Usuario = usuarioModel(sequelize);
const Valoracion = valoracionModel(sequelize);
const WalletMaestra = walletMaestraModel(sequelize);

// 🆕 INITIALIZE TRADING MODELS
const TradingPair = tradingPairModel(sequelize);
const Order = orderModel(sequelize);
const Trade = tradeModel(sequelize);
const PriceCandle = priceCandleModel(sequelize);
const IdempotencyKey = idempotencyKeyModel(sequelize);

// 🆕 LEDGER MODELS (partida doble)
const CuentaLedger = initCuentaLedger(sequelize);
const AsientoLedger = initAsientoLedger(sequelize);
const MovimientoLedger = initMovimientoLedger(sequelize);
const SaldoLedger = initSaldoLedger(sequelize);



// Relationships between tables
// ================================
// RELACIONES DE USUARIOS
// ================================

// Usuario puede tener muchos balances
// Fix 2026-08-19 (AUDITORIA_BACKEND.md Críticos #9): la columna real en
// balances_users es user_id (userId en el modelo), no usuarioId — con
// 'usuarioId' Sequelize crea una columna fantasma nunca poblada y
// Usuario.include('balances') devolvía siempre un array vacío en silencio.
Usuario.hasMany(BalanceUsuario, { foreignKey: 'userId', as: 'balances' });
BalanceUsuario.belongsTo(Usuario, { foreignKey: 'userId', as: 'usuario' });

// Usuario puede tener muchas direcciones de depósito
// Mismo bug (Críticos #9), y encima asimétrico: el belongsTo ya se había
// corregido a userId pero el hasMany inverso se había quedado en usuarioId.
Usuario.hasMany(DireccionDeposito, { foreignKey: 'userId', as: 'direccionesDeposito' });
DireccionDeposito.belongsTo(Usuario, { foreignKey: 'userId', as: 'usuario' });

// Usuario puede crear muchas ofertas P2P
Usuario.hasMany(OfertaP2P, { foreignKey: 'usuarioId', as: 'ofertas' });
OfertaP2P.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario' });

// Usuario puede ser comprador en transacciones P2P
Usuario.hasMany(TransaccionP2P, { foreignKey: 'compradorId', as: 'compras' });
TransaccionP2P.belongsTo(Usuario, { foreignKey: 'compradorId', as: 'comprador' });

// Usuario puede ser vendedor en transacciones P2P
Usuario.hasMany(TransaccionP2P, { foreignKey: 'vendedorId', as: 'ventas' });
TransaccionP2P.belongsTo(Usuario, { foreignKey: 'vendedorId', as: 'vendedor' });


// Usuario puede hacer muchos intercambios con el exchange
Usuario.hasMany(IntercambioExchange, { foreignKey: 'usuarioId', as: 'intercambios' });
IntercambioExchange.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario' });

// Usuario puede evaluar a otros usuarios
Usuario.hasMany(Valoracion, { foreignKey: 'usuarioEvaluadorId', as: 'valoracionesDadas' });
Valoracion.belongsTo(Usuario, { foreignKey: 'usuarioEvaluadorId', as: 'evaluador' });

// Usuario puede ser evaluado por otros usuarios
Usuario.hasMany(Valoracion, { foreignKey: 'usuarioEvaluadoId', as: 'valoracionesRecibidas' });
Valoracion.belongsTo(Usuario, { foreignKey: 'usuarioEvaluadoId', as: 'evaluado' });

// Usuario puede hacer transacciones blockchain
// Fix 2026-08-19 (AUDITORIA_BACKEND.md Críticos #9): mismo bug que arriba —
// la columna real en transacciones_blockchain es user_id, no usuarioId.
Usuario.hasMany(TransaccionBlockchain, { foreignKey: 'userId', as: 'transaccionesBlockchain' });
TransaccionBlockchain.belongsTo(Usuario, { foreignKey: 'userId', as: 'usuario' });

// Admin puede aprobar transacciones blockchain
Usuario.hasMany(TransaccionBlockchain, { foreignKey: 'aprobadoPor', as: 'transaccionesAprobadas' });
TransaccionBlockchain.belongsTo(Usuario, { foreignKey: 'aprobadoPor', as: 'adminAprobador' });

// 🆕 Usuario puede crear muchas órdenes de trading
Usuario.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
Order.belongsTo(Usuario, { foreignKey: 'userId', as: 'user' });

// 🆕 Usuario puede ser comprador en trades
Usuario.hasMany(Trade, { foreignKey: 'buyerId', as: 'buyTrades' });
Trade.belongsTo(Usuario, { foreignKey: 'buyerId', as: 'buyer' });

// 🆕 Usuario puede ser vendedor en trades
Usuario.hasMany(Trade, { foreignKey: 'sellerId', as: 'sellTrades' });
Trade.belongsTo(Usuario, { foreignKey: 'sellerId', as: 'seller' });

// ================================
// RELACIONES DE CRIPTOMONEDAS
// ================================

// Criptomoneda puede tener una wallet maestra
Criptomoneda.hasOne(WalletMaestra, { foreignKey: 'criptomonedaId', as: 'walletMaestra' });
WalletMaestra.belongsTo(Criptomoneda, { foreignKey: 'criptomonedaId', as: 'criptomoneda' });

// Criptomoneda puede tener muchas direcciones de depósito
Criptomoneda.hasMany(DireccionDeposito, { foreignKey: 'criptomonedaId', as: 'direccionesDeposito' });
DireccionDeposito.belongsTo(Criptomoneda, { foreignKey: 'criptomonedaId', as: 'criptomoneda' });

// Criptomoneda puede tener muchos balances de usuarios
Criptomoneda.hasMany(BalanceUsuario, { foreignKey: 'criptomonedaId', as: 'balances' });
BalanceUsuario.belongsTo(Criptomoneda, { foreignKey: 'criptomonedaId', as: 'criptomoneda' });

// Criptomoneda puede estar en muchas ofertas P2P
Criptomoneda.hasMany(OfertaP2P, { foreignKey: 'criptomonedaId', as: 'ofertas' });
OfertaP2P.belongsTo(Criptomoneda, { foreignKey: 'criptomonedaId', as: 'criptomoneda' });

// Criptomoneda puede estar en muchas transacciones P2P
Criptomoneda.hasMany(TransaccionP2P, { foreignKey: 'criptomonedaId', as: 'transaccionesP2P' });
TransaccionP2P.belongsTo(Criptomoneda, { foreignKey: 'criptomonedaId', as: 'criptomoneda' });

// Criptomoneda puede ser base en pares de exchange
Criptomoneda.hasMany(ParExchange, { foreignKey: 'criptoBaseId', as: 'paresComoBase' });
ParExchange.belongsTo(Criptomoneda, { foreignKey: 'criptoBaseId', as: 'criptoBase' });

// Criptomoneda puede ser quote en pares de exchange
Criptomoneda.hasMany(ParExchange, { foreignKey: 'criptoQuoteId', as: 'paresComoQuote' });
ParExchange.belongsTo(Criptomoneda, { foreignKey: 'criptoQuoteId', as: 'criptoQuote' });

// Criptomoneda puede estar en transacciones blockchain
Criptomoneda.hasMany(TransaccionBlockchain, { foreignKey: 'criptomonedaId', as: 'transaccionesBlockchain' });
TransaccionBlockchain.belongsTo(Criptomoneda, { foreignKey: 'criptomonedaId', as: 'criptomoneda' });

// 🆕 Criptomoneda puede ser base asset en pares de trading
Criptomoneda.hasMany(TradingPair, { foreignKey: 'baseAssetId', as: 'tradingPairsAsBase' });
TradingPair.belongsTo(Criptomoneda, { foreignKey: 'baseAssetId', as: 'baseAsset' });

// 🆕 Criptomoneda puede ser quote asset en pares de trading
Criptomoneda.hasMany(TradingPair, { foreignKey: 'quoteAssetId', as: 'tradingPairsAsQuote' });
TradingPair.belongsTo(Criptomoneda, { foreignKey: 'quoteAssetId', as: 'quoteAsset' });

// ================================
// RELACIONES DE PARES EXCHANGE
// ================================

// Par exchange puede tener muchos intercambios
ParExchange.hasMany(IntercambioExchange, { foreignKey: 'parId', as: 'intercambios' });
IntercambioExchange.belongsTo(ParExchange, { foreignKey: 'parId', as: 'par' });

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
WalletMaestra.hasMany(DireccionDeposito, { foreignKey: 'walletMaestraId', as: 'direccionesDeposito' });
DireccionDeposito.belongsTo(WalletMaestra, { foreignKey: 'walletMaestraId', as: 'walletMaestra' });

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
// lo es, está activo. Sin esto, cualquier función de valoracion.model.js
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

// Usuario puede ser remitente en muchas transferencias
Usuario.hasMany(Transferencia, { foreignKey: 'usuarioRemitenteId', as: 'transferenciasEnviadas' });
Transferencia.belongsTo(Usuario, { foreignKey: 'usuarioRemitenteId', as: 'remitente' });

// Usuario puede ser destinatario en muchas transferencias
Usuario.hasMany(Transferencia, { foreignKey: 'usuarioDestinatarioId', as: 'transferenciasRecibidas' });
Transferencia.belongsTo(Usuario, { foreignKey: 'usuarioDestinatarioId', as: 'destinatario' });

// Transferencia pertenece a una criptomoneda
Criptomoneda.hasMany(Transferencia, { foreignKey: 'criptomonedaId', as: 'transferencias' });
Transferencia.belongsTo(Criptomoneda, { foreignKey: 'criptomonedaId', as: 'criptomonedaTransferencia' }); // Alias único


// ================================
// RELACIONES DEL LEDGER (partida doble)
// ================================
AsientoLedger.hasMany(MovimientoLedger, { foreignKey: 'asientoId', as: 'movimientos' });
MovimientoLedger.belongsTo(AsientoLedger, { foreignKey: 'asientoId', as: 'asiento' });
MovimientoLedger.belongsTo(CuentaLedger, { foreignKey: 'cuentaId', as: 'cuenta' });
CuentaLedger.hasMany(MovimientoLedger, { foreignKey: 'cuentaId', as: 'movimientos' });
CuentaLedger.hasOne(SaldoLedger, { foreignKey: 'cuentaId', as: 'saldoProyectado' });
SaldoLedger.belongsTo(CuentaLedger, { foreignKey: 'cuentaId', as: 'cuenta' });



module.exports = {
  sequelize,
  Sequelize,
  BalanceUsuario,
  BlockchainState,
  Criptomoneda,
  DireccionDeposito,
  IntercambioExchange,
  MetodoPago,
  Notificaciones,
  OfertaMetodoPago,
  OfertaP2P,
  ParExchange,
  TransaccionBlockchain,
  TransaccionP2P,
  Transferencia,
  Usuario,
  Valoracion,
  WalletMaestra,
  // 🆕 TRADING MODELS
  TradingPair,
  Order,
  Trade,
  PriceCandle,
  IdempotencyKey,
  // 🆕 LEDGER MODELS (partida doble)
  CuentaLedger,
  AsientoLedger,
  MovimientoLedger,
  SaldoLedger,
};