const { Sequelize } = require('sequelize');
const config = require('../config/database');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];


// Import models
const balanceUsuarioModel = require('./balanceUsuario.model');
const createBlockchainStateModel = require('./blockchainState.model');
//const categoriaReclamoModel = require('./categoriaReclamo.model');
const criptomonedaModel = require('./criptomoneda.model.js');
const direccionDepositoModel = require('./direccionDeposito.model');
const intercambioExchangeModel = require('./intercambioExchange.model');
//const logAdminModel = require('./logAdmin.model');
//const logTransaccionModel = require('./logTransaccion.model');
//const mensajeReclamoModel = require('./mensajeReclamo.model');
const metodoPagoModel = require('./metodoPago.model');
const notificacionesModel = require('./notificaciones.model');
const ofertaMetodoPagoModel = require('./ofertaMetodoPago.model');
const ofertaP2PModel = require('./ofertaP2P.model');
const parExchangeModel = require('./parExchange.model');
//const reclamoModel = require('./reclamo.model');
const transaccionBlockchainModel = require('./transaccionBlockchain.model');
const transaccionP2PModel = require('./transaccionesP2P.model');
const transferenciaModel = require('./transferencia.model.js')
const usuarioModel = require('./usuario.model');
const valoracionModel = require('./valoracion.model');
const walletMaestraModel = require('./walletMaestra.model');



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
//const CategoriaReclamo = categoriaReclamoModel(sequelize);
const Criptomoneda = criptomonedaModel(sequelize);
const DireccionDeposito = direccionDepositoModel(sequelize);
const IntercambioExchange = intercambioExchangeModel(sequelize);
//const LogAdmin = logAdminModel(sequelize);
//const LogTransaccion = logTransaccionModel(sequelize);
//const MensajeReclamo = mensajeReclamoModel(sequelize);
const MetodoPago = metodoPagoModel(sequelize);
const Notificaciones = notificacionesModel(sequelize);
const OfertaMetodoPago = ofertaMetodoPagoModel(sequelize);
const OfertaP2P = ofertaP2PModel(sequelize);  
const ParExchange = parExchangeModel(sequelize);
//const Reclamo = reclamoModel(sequelize);
const TransaccionBlockchain = transaccionBlockchainModel(sequelize);
const TransaccionP2P = transaccionP2PModel(sequelize);
const Transferencia = transferenciaModel(sequelize);
const Usuario = usuarioModel(sequelize);
const Valoracion = valoracionModel(sequelize);
const WalletMaestra = walletMaestraModel(sequelize);



// Relationships between tables
// ================================
// RELACIONES DE USUARIOS
// ================================

// Usuario puede tener muchos balances
Usuario.hasMany(BalanceUsuario, { foreignKey: 'usuarioId', as: 'balances' });
BalanceUsuario.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario' });

// Usuario puede tener muchas direcciones de depósito
Usuario.hasMany(DireccionDeposito, { foreignKey: 'usuarioId', as: 'direccionesDeposito' });
DireccionDeposito.belongsTo(Usuario, { foreignKey: 'userId', as: 'usuario' }); //Antes: (Usuario, { foreignKey: 'usuarioId', as: 'usuario' })

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
Usuario.hasMany(TransaccionBlockchain, { foreignKey: 'usuarioId', as: 'transaccionesBlockchain' });
TransaccionBlockchain.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario' });

// Admin puede aprobar transacciones blockchain
Usuario.hasMany(TransaccionBlockchain, { foreignKey: 'aprobadoPor', as: 'transaccionesAprobadas' });
TransaccionBlockchain.belongsTo(Usuario, { foreignKey: 'aprobadoPor', as: 'adminAprobador' });
/*
// Usuario puede crear reclamos
Usuario.hasMany(Reclamo, { foreignKey: 'usuarioId', as: 'reclamos' });
Reclamo.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario' });

// Admin puede ser asignado a reclamos
Usuario.hasMany(Reclamo, { foreignKey: 'adminAsignadoId', as: 'reclamosAsignados' });
Reclamo.belongsTo(Usuario, { foreignKey: 'adminAsignadoId', as: 'adminAsignado' });

// Usuario puede escribir mensajes en reclamos
Usuario.hasMany(MensajeReclamo, { foreignKey: 'autorId', as: 'mensajesReclamos' });
MensajeReclamo.belongsTo(Usuario, { foreignKey: 'autorId', as: 'autor' });

// Admin puede generar logs de administración
Usuario.hasMany(LogAdmin, { foreignKey: 'adminId', as: 'logsAdmin' });
LogAdmin.belongsTo(Usuario, { foreignKey: 'adminId', as: 'admin' });

// Usuario puede generar logs de transacciones
Usuario.hasMany(LogTransaccion, { foreignKey: 'usuarioId', as: 'logsTransacciones' });
LogTransaccion.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario' });
/*
// ================================
// RELACIONES DE CRIPTOMONEDAS
// ================================
*/
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

// ================================
// RELACIONES DE PARES EXCHANGE
// ================================

// Par exchange puede tener muchos intercambios
ParExchange.hasMany(IntercambioExchange, { foreignKey: 'parId', as: 'intercambios' });
IntercambioExchange.belongsTo(ParExchange, { foreignKey: 'parId', as: 'par' });

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

/*
// Transacción P2P puede tener muchas valoraciones
TransaccionP2P.hasMany(Valoracion, { foreignKey: 'transaccionP2PId', as: 'valoraciones' });
Valoracion.belongsTo(TransaccionP2P, { foreignKey: 'transaccionP2PId', as: 'transaccion' });

// Transacción P2P puede tener reclamos
TransaccionP2P.hasMany(Reclamo, { foreignKey: 'transaccionP2PId', as: 'reclamos' });
Reclamo.belongsTo(TransaccionP2P, { foreignKey: 'transaccionP2PId', as: 'transaccionP2P' });

// ================================
// RELACIONES DE RECLAMOS
// ================================

// Categoría de reclamo puede tener muchos reclamos
CategoriaReclamo.hasMany(Reclamo, { foreignKey: 'categoriaId', as: 'reclamos' });
Reclamo.belongsTo(CategoriaReclamo, { foreignKey: 'categoriaId', as: 'categoria' });

// Reclamo puede tener muchos mensajes
Reclamo.hasMany(MensajeReclamo, { foreignKey: 'reclamoId', as: 'mensajes' });
MensajeReclamo.belongsTo(Reclamo, { foreignKey: 'reclamoId', as: 'reclamo' });
*/


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



module.exports = {
  sequelize,
  Sequelize,
  BalanceUsuario,
  BlockchainState,
  //CategoriaReclamo,
  Criptomoneda,
  DireccionDeposito,
  IntercambioExchange,
  //LogAdmin,
  //LogTransaccion,
  //MensajeReclamo,
  MetodoPago,
  Notificaciones,
  OfertaMetodoPago,
  OfertaP2P,
  ParExchange,
  //Reclamo,
  TransaccionBlockchain,
  TransaccionP2P,
  Transferencia,
  Usuario,
  //Valoracion,
  WalletMaestra
};

