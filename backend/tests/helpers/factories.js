const jwt = require('jsonwebtoken');
const {
  User, Crypto, ParExchange, UserBalance, MasterWallet, TradingPair,
} = require('../../models');

let seq = 0;
const uniq = () => `${Date.now()}${seq++}`;

// Creates an active, email-verified local user by default (passes
// authenticateToken + requireEmailVerified). passwordHash is set because the
// User beforeCreate hook rejects a non-Google user without one.
async function seedUser(overrides = {}) {
  const n = uniq();
  return User.create({
    email: `user${n}@test.local`,
    username: `user_${n}`,
    passwordHash: 'not-used-by-token-auth',
    emailVerified: true,
    active: true,
    role: 'normal',
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
  return Crypto.create({ symbol, name: symbol, network: 'test' });
}

async function seedPar({ base, quote, precio, comision }) {
  return ParExchange.create({
    criptoBaseId: base.id,
    criptoQuoteId: quote.id,
    precioActual: precio,
    comisionPorcentaje: comision,
    active: true,
  });
}

// Paso C: balances_users ya no existe → seedBalance siembra SÓLO el ledger, con
// un asiento 'apertura' (contrapartida en la cuenta de casa 'apertura') que
// acredita funding:disponible del usuario. El saldo autoritativo es el ledger.
async function seedBalance(user, cripto, monto) {
  const { postTransaction } = require('../../modules/balances/ledger/postingService');
  const { PURPOSES } = require('../../modules/balances/ledger/ledgerAccounts');
  const cryptoMod = require('crypto');
  return postTransaction({
    type: 'apertura',
    reference: `seed:${cryptoMod.randomUUID()}`,
    lines: [
      { ownerId: null, purpose: PURPOSES.APERTURA, cryptoId: cripto.id, amount: `-${monto}` },
      { ownerId: user.id, purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: cripto.id, amount: String(monto) },
    ],
  });
}

// Siembra saldo directo en spot:disponible (apertura → spot). Para tests que
// necesitan fondos ya en el compartimento de trading sin pasar por la transferencia.
async function seedSpotBalance(user, cripto, monto) {
  const { postTransaction } = require('../../modules/balances/ledger/postingService');
  const { PURPOSES } = require('../../modules/balances/ledger/ledgerAccounts');
  const cryptoMod = require('crypto');
  return postTransaction({
    type: 'apertura',
    reference: `seed-spot:${cryptoMod.randomUUID()}`,
    lines: [
      { ownerId: null, purpose: PURPOSES.APERTURA, cryptoId: cripto.id, amount: `-${monto}` },
      { ownerId: user.id, purpose: PURPOSES.SPOT_AVAILABLE, cryptoId: cripto.id, amount: String(monto) },
    ],
  });
}

// Lee spot:disponible y spot:bloqueado desde la proyeccion del ledger. Para tests
// que verifican balances del compartimento de trading.
async function getSpotBalance(user, cripto) {
  return UserBalance.getCompartmentBalance(user.id, cripto.id, 'spot');
}

// network 'test' sidesteps the network-specific xpub validation; the swap only
// looks the wallet up by criptomonedaId to credit the commission (totalBalance).
async function seedWalletMaestra(cripto) {
  return MasterWallet.create({
    cryptoId: cripto.id,
    name: `${cripto.symbol} test wallet`,
    network: 'test',
    symbol: cripto.symbol,
    xpub: 'testxpub',
  });
}

// Write-flip (Paso B): el saldo autoritativo es el ledger, no balances_users
// (las escrituras postean al ledger directo). getBalance lee la proyeccion via
// getByUserAndCrypto → devuelve { userId, criptomonedaId, availableBalance,
// blockedBalance } con strings canonicos, mismo shape que usan los tests.
async function getBalance(user, cripto) {
  return UserBalance.getByUserAndCrypto(user.id, cripto.id);
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
