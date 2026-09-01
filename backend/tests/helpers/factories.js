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

async function seedBalance(user, cripto, monto) {
  // La fila legacy se crea con hooks:false (el mirror NO dispara) y el ledger se
  // siembra directo con un asiento 'apertura' → seedBalance no depende del mirror
  // (que se elimina en el write-flip). Mismo valor de funding, contrapartida en
  // la cuenta de casa 'apertura'.
  const { postTransaction } = require('../../services/ledger/postingService');
  const { PROPOSITOS } = require('../../services/ledger/ledgerAccounts');
  const crypto = require('crypto');
  const fila = await BalanceUsuario.create({
    userId: user.id,
    criptomonedaId: cripto.id,
    balanceDisponible: monto,
    balanceBloqueado: '0',
  }, { hooks: false });
  await postTransaction({
    tipo: 'apertura',
    referencia: `seed:${crypto.randomUUID()}`,
    lineas: [
      { ownerId: null, proposito: PROPOSITOS.APERTURA, criptomonedaId: cripto.id, monto: `-${monto}` },
      { ownerId: user.id, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id, monto: String(monto) },
    ],
  });
  return fila;
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
  seedBalance, seedWalletMaestra, getBalance, seedTradingPair,
};
