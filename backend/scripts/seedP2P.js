// backend/scripts/seedP2P.js
//
// Dev seeder: creates a batch of ACTIVE P2P offers (buy/sell, across cryptos +
// payment methods) from existing users, so the P2P marketplace shows activity.
// Idempotent: tags offers with a marker and clears previously-seeded ones first.
//
// NOTE: offers auto-expire after 12h (P2POffer.deactivateExpiredOffers), so re-run
// this to refresh the marketplace. Run from backend/ so dotenv loads backend/.env:
//   node scripts/seedP2P.js
require('dotenv').config();

const MARKER = '[demo-seed]';
const USD_PRICE = { BTC: 77000, ETH: 2900, BNB: 600, SOL: 180, XRP: 2.3, ADA: 0.9, DOGE: 0.38, USDT: 1, USDC: 1, DAI: 1 };
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function main() {
  const { sequelize, P2POffer, OfferPaymentMethod, PaymentMethod, Crypto, User } = require('../models');
  await sequelize.authenticate();
  console.log(`✅ DB ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);

  const users = await User.findAll({ attributes: ['id', 'username', 'email'], limit: 12 });
  const cryptos = await Crypto.findAll({ where: { active: true }, attributes: ['id', 'symbol'] });
  const methods = await PaymentMethod.findAll({ where: { active: true }, attributes: ['id', 'name'] });

  if (users.length === 0 || cryptos.length === 0 || methods.length === 0) {
    console.error(`❌ Faltan datos base: users=${users.length} cryptos=${cryptos.length} paymentMethods=${methods.length}. Corré seedInitialData / seedLogosAndPaymentMethods primero.`);
    await sequelize.close();
    process.exit(1);
  }

  // Makers: prefer users that are NOT the owner/test account so their "My offers" stays clean.
  const makers = users.filter((u) => u.username !== 'demo' && !/grgurich/i.test(u.email || ''));
  const makerPool = makers.length > 0 ? makers : users;

  // Idempotent: clear previously-seeded offers + their payment-method links.
  const old = await P2POffer.findAll({ where: { additionalTerms: { [sequelize.Sequelize.Op.like]: `%${MARKER}%` } }, attributes: ['id'] });
  if (old.length) {
    const ids = old.map((o) => o.id);
    await OfferPaymentMethod.destroy({ where: { offerId: ids } });
    await P2POffer.destroy({ where: { id: ids } });
    console.log(`🧹 Limpié ${ids.length} ofertas sembradas previas`);
  }

  const tradable = cryptos.filter((c) => USD_PRICE[c.symbol] != null);
  const pool = tradable.length > 0 ? tradable : cryptos;
  const COUNT = 18;
  let made = 0;

  for (let i = 0; i < COUNT; i++) {
    const crypto = pick(pool);
    const base = USD_PRICE[crypto.symbol] ?? 1;
    const type = Math.random() > 0.5 ? 'buy' : 'sell';
    // Buyers bid a touch under, sellers ask a touch over market.
    const unitPrice = Number((base * (type === 'buy' ? rnd(0.985, 0.999) : rnd(1.001, 1.015))).toFixed(4));
    const minAmount = Number(rnd(0.01, 0.1).toFixed(8));
    const maxAmount = Number((minAmount + rnd(0.1, 1.5)).toFixed(8));

    const offer = await P2POffer.create({
      userId: pick(makerPool).id,
      type,
      cryptoId: crypto.id,
      minAmount: String(minAmount),
      maxAmount: String(maxAmount),
      unitPrice: String(unitPrice),
      fiatCurrency: 'USD',
      additionalTerms: `Pago en 15 min. ${MARKER}`,
      active: true,
    });

    // Link 1–2 payment methods.
    const nMethods = 1 + Math.floor(Math.random() * 2);
    const chosen = [...methods].sort(() => Math.random() - 0.5).slice(0, nMethods);
    await OfferPaymentMethod.bulkCreate(chosen.map((m) => ({ offerId: offer.id, paymentMethodId: m.id })), { ignoreDuplicates: true });
    made++;
  }

  console.log(`✅ ${made} ofertas P2P sembradas (makers=${makerPool.length}, cryptos=${pool.length}, métodos=${methods.length}).`);
  await sequelize.close();
  process.exit(0);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
