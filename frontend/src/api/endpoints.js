// src/api/endpoints.js
export const ENDPOINTS = {
  // Auth
  AUTH_GOOGLE: '/auth/google',
  AUTH_LOGOUT: '/auth/logout',
  USER_PROFILE: '/usuario/me',
  USER_SEARCH: '/usuario/search',

  //Registros
  USER_REGISTER: '/usuario/register',
  USER_LOGIN: '/usuario/login',

  //Login
  USER_LOGIN: '/usuario/login',
  USER_VERIFY_2FA: '/usuario/verify-2fa',
  USER_RESEND_2FA: '/usuario/resend-2fa',

  //Super_admin
  SETUP_WALLETS_INITIALIZE: '/setupWallets/initialize',
  EXCHANGE_PAIRS_GENERATE: '/parExchange/generate-all',
  PAYMENT_METHOD_CREATE: '/metodoPago',

  // Cryptos
  CRYPTOS_ACTIVE: '/criptomoneda/public/active',
  CRYPTO_BY_ID: (id) => `/criptomoneda/${id}`,
  CRYPTO_BY_SYMBOL: (symbol) => `/criptomoneda/symbol/${symbol}`,

  // Balances
  MY_BALANCES: '/balances/my/balances',
  BALANCE_UPDATE_USER: (userId, cryptoId) => `/balances/user/${userId}/crypto/${cryptoId}`,

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

  // Markets
  COINGECKO_MARKETS: (page, perPage) =>
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=false`,
};