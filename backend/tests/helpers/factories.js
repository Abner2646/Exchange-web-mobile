const jwt = require('jsonwebtoken');
const {
  Usuario, Criptomoneda, ParExchange, BalanceUsuario, WalletMaestra, TradingPair,
} = require('../../models');

let seq = 0;
const uniq = () => `${Date.now()}${seq++}`;

// Creates an active, email-verified local user by default (passes
// authenticateToken + requireEmailVerified). passwordHash is set because the
// Usuario beforeCreate hook rejects a non-Google user without one.
async function seedUser(overrides = {}) {
  const n = uniq();
  return Usuario.create({
    email: `user${n}@test.local`,
    username: `user_${n}`,
    passwordHash: 'not-used-by-token-auth',
    emailVerificado: true,
    activo: true,
    rol: 'normal',
    ...overrides,
  });
}

// Mints a JWT the auth middleware accepts: it verifies with JWT_SECRET and
// loads the user by decoded.id.
function authTokenFor(user) {
  return jwt.sign({ id: user.id }, process.env.JWT_SECRET);
}

function authHeader(user) {
  return { Authorization: `Bearer ${authTokenFor(user)}` };
}

async function seedCripto(symbol) {
  return Criptomoneda.create({ symbol, nombre: symbol, red: 'test' });
}

async function seedPar({ base, quote, precio, comision }) {
  return ParExchange.create({
    criptoBaseId: base.id,
    criptoQuoteId: quote.id,
    precioActual: precio,
    comisionPorcentaje: comision,
    activo: true,
  });
}

// Paso C: balances_users ya no existe → seedBalance siembra SÓLO el ledger, con
// un asiento 'apertura' (contrapartida en la cuenta de casa 'apertura') que
// acredita funding:disponible del usuario. El saldo autoritativo es el ledger.
async function seedBalance(user, cripto, monto) {
  const { postTransaction } = require('../../services/ledger/postingService');
  const { PROPOSITOS } = require('../../services/ledger/ledgerAccounts');
  const cryptoMod = require('crypto');
  return postTransaction({
    tipo: 'apertura',
    referencia: `seed:${cryptoMod.randomUUID()}`,
    lineas: [
      { ownerId: null, proposito: PROPOSITOS.APERTURA, criptomonedaId: cripto.id, monto: `-${monto}` },
      { ownerId: user.id, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id, monto: String(monto) },
    ],
  });
}

// Siembra saldo directo en spot:disponible (apertura → spot). Para tests que
// necesitan fondos ya en el compartimento de trading sin pasar por la transferencia.
async function seedSpotBalance(user, cripto, monto) {
  const { postTransaction } = require('../../services/ledger/postingService');
  const { PROPOSITOS } = require('../../services/ledger/ledgerAccounts');
  const cryptoMod = require('crypto');
  return postTransaction({
    tipo: 'apertura',
    referencia: `seed-spot:${cryptoMod.randomUUID()}`,
    lineas: [
      { ownerId: null, proposito: PROPOSITOS.APERTURA, criptomonedaId: cripto.id, monto: `-${monto}` },
      { ownerId: user.id, proposito: PROPOSITOS.SPOT_DISPONIBLE, criptomonedaId: cripto.id, monto: String(monto) },
    ],
  });
}

// Lee spot:disponible y spot:bloqueado desde la proyeccion del ledger. Para tests
// que verifican balances del compartimento de trading.
async function getSpotBalance(user, cripto) {
  return BalanceUsuario.getSaldoCompartimento(user.id, cripto.id, 'spot');
}

// red 'test' sidesteps the network-specific xpub validation; the swap only
// looks the wallet up by criptomonedaId to credit the commission (balanceTotal).
async function seedWalletMaestra(cripto) {
  return WalletMaestra.create({
    criptomonedaId: cripto.id,
    nombre: `${cripto.symbol} test wallet`,
    red: 'test',
    symbol: cripto.symbol,
    xpub: 'testxpub',
  });
}

// Write-flip (Paso B): el saldo autoritativo es el ledger, no balances_users
// (las escrituras postean al ledger directo). getBalance lee la proyeccion via
// getByUserAndCrypto → devuelve { userId, criptomonedaId, balanceDisponible,
// balanceBloqueado } con strings canonicos, mismo shape que usan los tests.
async function getBalance(user, cripto) {
  return BalanceUsuario.getByUserAndCrypto(user.id, cripto.id);
}

// Spot trading pair. lastPrice defaults to 0 so the order validator's
// 50%-deviation gate (only active when lastPrice > 0) stays out of the way;
// maker/taker fees default to 0.1%.
async function seedTradingPair({ base, quote, makerFee = '0.1', takerFee = '0.1', minOrderAmount = '0', lastPrice = '0', status = 'active' }) {
  return TradingPair.create({
    symbol: `${base.symbol}/${quote.symbol}`,
    baseAssetId: base.id,
    quoteAssetId: quote.id,
    status,
    minOrderAmount,
    makerFeePercent: makerFee,
    takerFeePercent: takerFee,
    lastPrice,
  });
}

module.exports = {
  seedUser, authTokenFor, authHeader, seedCripto, seedPar,
  seedBalance, seedSpotBalance, seedWalletMaestra, getBalance, getSpotBalance, seedTradingPair,
};
