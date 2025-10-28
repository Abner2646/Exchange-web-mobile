// src/api/endpoints.js 
export const ENDPOINTS = {
  // Auth
  AUTH_GOOGLE: '/auth/google',
  AUTH_LOGOUT: '/auth/logout',
  USER_PROFILE: '/usuario/me',
  USER_SEARCH: '/usuario/search',

  //Registros
  USER_REGISTER: '/usuario/register',

  //Login
  USER_LOGIN: '/usuario/login',
  USER_VERIFY_2FA: '/usuario/verify-2fa',
  USER_RESEND_2FA: '/usuario/resend-2fa',

  //Verificación de Email
  USER_VERIFY_EMAIL: '/usuario/verify-email',
  USER_RESEND_VERIFICATION_EMAIL: '/usuario/resend-verification-email',

  //Super_admin
  SETUP_WALLETS_INITIALIZE: '/setupWallets/initialize',
  EXCHANGE_PAIRS_GENERATE: '/parExchange/generate-all',
  PAYMENT_METHOD_CREATE: '/metodoPago',

  // Cryptos
  CRYPTOS_ACTIVE: '/criptomoneda/public/active',
  CRYPTO_BY_ID: (id) => `/criptomoneda/${id}`,
  CRYPTO_BY_SYMBOL: (symbol) => `/criptomoneda/symbol/${symbol}`,
  CRYPTO_GENERATE_ALL_ICONS: '/criptomoneda/generate-all-icons',

  // Balances
  MY_BALANCES: '/balances/my/balances',
  BALANCE_UPDATE_USER: (userId, cryptoId) => `/balances/user/${userId}/crypto/${cryptoId}`,
  BALANCE_STATS: '/balances/stats',

  // Prices
  PRICE: (from, to) => `/parExchange/price/${from}/${to}`,

  // Transfers
  TRANSFERS: '/transferencia',
  MY_TRANSFERS: '/transferencia/my',
  TRANSFER_VERIFY_FUNDS: '/transferencia/verify-funds',
  TRANSFER_PROCESS: (id) => `/transferencia/${id}/process`,
  TRANSFER_RESEND_CODE: (id) => `/transferencia/${id}/resend-code`,
  
  //Depositos
  DEPOSIT_ADDRESS_BY_CRYPTO: (cryptoId) => `/direccionDeposito/user/me/crypto/${cryptoId}`,

  //Retiros
  TRANSACTIONS_WITHDRAW: '/transactions/withdraw',

  //P2P:
  P2P_CRYPTOS: '/criptomoneda',
  P2P_METODOS_PAGO_ACTIVOS: '/metodoPago/status/active',
  P2P_OFERTAS: '/ofertaP2P',
  P2P_USER_PUBLIC_PROFILE: (userId) => `/usuario/public/${userId}`,

  //P2P Mis Operaciones:
  P2P_MY_OFERTAS: '/ofertaP2P/me/ofertas',
  P2P_MY_TRANSACCIONES: '/transaccionP2P/me/transacciones',
  P2P_MY_TRANSACCIONES_PENDING: '/transaccionP2P/me/pending',
  P2P_OFERTA_TOGGLE: (ofertaId) => `/ofertaP2P/${ofertaId}/toggle`,
  P2P_TRANSACCION_CONFIRM_PAYMENT: (transaccionId) => `/transaccionP2P/${transaccionId}/confirm-payment`,
  P2P_TRANSACCION_COMPLETE: (transaccionId) => `/transaccionP2P/${transaccionId}/complete`,
  P2P_TRANSACCION_CANCEL: (transaccionId) => `/transaccionP2P/${transaccionId}/cancel`,
  P2P_TRANSACCION_DETAILS: (transaccionId) => `/p2p/transaction/${transaccionId}`,

  // P2P Crear Oferta:
  P2P_CREATE_OFERTA: '/ofertaP2P',

  // Notificaciones
  NOTIFICATIONS_ME: '/notificaciones/me',
  NOTIFICATIONS_UNREAD_COUNT: '/notificaciones/me/unread-count',
  NOTIFICATIONS_MARK_ALL_READ: '/notificaciones/me/mark-all-read',
  NOTIFICATIONS_MARK_READ: (id) => `/notificaciones/me/${id}/mark-read`,
  NOTIFICATIONS_MARK_UNREAD: (id) => `/notificaciones/me/${id}/mark-unread`,

  //Usuario - Configuración del perfil
  USER_CHANGE_PASSWORD: '/usuario/me/change-password',
  USER_2FA_TOGGLE: '/usuario/me/2fa-toggle',

  // Swap/Exchange
  EXCHANGE_PAIR_BY_SYMBOLS: (base, quote) => `/parExchange/symbols/${base}/${quote}`,
  EXCHANGE_PRICE: (base, quote) => `/parExchange/price/${base}/${quote}`,
  EXCHANGE_CALCULATE: '/intercambioExchange/calculate',
  EXCHANGE_EXECUTE: '/intercambioExchange/',
  EXCHANGE_CHECK_LIMIT: '/intercambioExchange/check-limit',
  BALANCE_CHECK: (userId, cryptoId, amount) => `/balances/user/${userId}/crypto/${cryptoId}/check?amount=${amount}`,

  // Markets
  COINGECKO_MARKETS: (page, perPage) =>
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=false&price_change_percentage=24h,7d`,

  // Stats globales de mercado
  COINGECKO_GLOBAL: 'https://api.coingecko.com/api/v3/global',

  
};

// ==================== TRADING ENDPOINTS ====================
export const TRADING_ENDPOINTS = {
  // Trading Pairs
  PAIRS: '/trading/pairs',
  PAIRS_ACTIVE: '/trading/pairs/active',
  PAIRS_TOP: '/trading/pairs/top',
  PAIRS_STATS: '/trading/pairs/stats',
  PAIR_BY_SYMBOL: (symbol) => `/trading/pairs/symbol/${symbol}`,
  PAIR_DETAIL: (pairId) => `/trading/pairs/${pairId}`,

  // Orders
  CREATE_ORDER: '/trading/orders',
  CANCEL_ORDER: (orderId) => `/trading/orders/${orderId}`,
  USER_ORDERS: '/trading/orders',
  ACTIVE_ORDERS: '/trading/orders/active',
  ORDER_DETAIL: (orderId) => `/trading/orders/${orderId}`,

  // Order Book
  ORDER_BOOK: (tradingPairId) => `/trading/orderbook/${tradingPairId}`,
  ORDER_BOOK_STATS: (tradingPairId) => `/trading/orderbook/${tradingPairId}/stats`,
  SPREAD: (tradingPairId) => `/trading/spread/${tradingPairId}`,

  // Trades
  RECENT_TRADES: (tradingPairId) => `/trading/trades/${tradingPairId}`,
  USER_TRADES: '/trading/trades/user/all',
  USER_TRADE_STATS: '/trading/trades/user/stats',
  TRADE_DETAIL: (tradeId) => `/trading/trades/detail/${tradeId}`,

  // Chart Data ORIGINAL
  /*CHART_DATA: (tradingPairId) => `/trading/chart/${tradingPairId}`,
  CHART_DATA_BINANCE: (tradingPairId) => `/trading/chart/${tradingPairId}/binance`,*/

  CHART_DATA_BINANCE: (tradingPairId) => `/trading/chart/${tradingPairId}`,
  CHART_DATA: (tradingPairId) => `/trading/chart/${tradingPairId}/binance`,

  // Statistics
  PAIR_STATS: (tradingPairId) => `/i/trading/stats/${tradingPairId}`,
  VOLUME: '/trading/volume',
  TICKERS: '/trading/tickers',
  USER_SUMMARY: '/trading/summary',

  // Balance
  BALANCE: '/trading/balance',
};