const jwt = require('jsonwebtoken');
const {
  Usuario, Criptomoneda, ParExchange, BalanceUsuario, WalletMaestra,
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
  return BalanceUsuario.create({
    userId: user.id,
    criptomonedaId: cripto.id,
    balanceDisponible: monto,
    balanceBloqueado: '0',
  });
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

async function getBalance(user, cripto) {
  return BalanceUsuario.findOne({ where: { userId: user.id, criptomonedaId: cripto.id } });
}

module.exports = {
  seedUser, authTokenFor, authHeader, seedCripto, seedPar,
  seedBalance, seedWalletMaestra, getBalance,
};
