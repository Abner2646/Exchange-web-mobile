// backend/scripts/seedCandles.js
//
// Dev-only seeder: injects closed OHLCV candles into `price_candles` for a trading
// pair across several intervals, so the lightweight-charts price chart renders with
// real data locally. Idempotent per (pair, interval): it deletes then re-inserts.
//
// Run from backend/ so dotenv loads backend/.env (local DB), NOT the root .env (cloud):
//   node scripts/seedCandles.js            # auto-picks BTC/USDT or the first active pair
//   node scripts/seedCandles.js ETH/USDT   # a specific pair symbol
//
// This does NOT touch app logic or money-path — it only writes market-data candles.
require('dotenv').config();

const INTERVAL_MS = { '1m': 60e3, '5m': 300e3, '15m': 900e3, '30m': 1800e3, '1h': 3600e3, '4h': 14400e3, '1d': 86400e3 };
const COUNT = 150; // per interval (>100 so MA99 and the limit=100 window have data)
const r8 = (n) => Number(n.toFixed(8));

async function main() {
  const symbolArg = process.argv[2];
  const { sequelize, TradingPair, PriceCandle } = require('../models');
  await sequelize.authenticate();
  console.log(`✅ DB ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);

  const pair =
    (symbolArg && (await TradingPair.findOne({ where: { symbol: symbolArg } }))) ||
    (await TradingPair.findOne({ where: { symbol: 'BTC/USDT' } })) ||
    (await TradingPair.findOne({ where: { status: 'active' } })) ||
    (await TradingPair.findOne());

  if (!pair) {
    console.error('❌ No hay pares de trading en la DB. Corré primero el seed de pares (seedInitialData / /trading/pairs/auto-create).');
    await sequelize.close();
    process.exit(1);
  }
  console.log(`📈 Par: ${pair.symbol} (${pair.id}) status=${pair.status} last=${pair.lastPrice}`);

  const base = Number(pair.lastPrice) > 0 ? Number(pair.lastPrice) : 65000;
  const intervals = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
  let total = 0;
  let h1 = null; // keep the 1h series to derive the pair ticker

  for (const interval of intervals) {
    const ms = INTERVAL_MS[interval];
    await PriceCandle.destroy({ where: { tradingPairId: pair.id, interval } });

    const now = Date.now();
    const startOpen = Math.floor((now - COUNT * ms) / ms) * ms; // aligned to the interval grid
    const rows = [];
    let price = base;
    for (let i = 0; i < COUNT; i++) {
      const openTime = new Date(startOpen + i * ms);
      const closeTime = new Date(openTime.getTime() + ms);
      const open = price;
      const close = Math.max(0.00000001, open * (1 + (Math.random() - 0.5) * 0.02)); // ±1% walk
      const high = Math.max(open, close) * (1 + Math.random() * 0.005);
      const low = Math.min(open, close) * (1 - Math.random() * 0.005);
      const volume = Math.random() * 5 + 0.5;
      rows.push({
        tradingPairId: pair.id, interval, openTime, closeTime,
        open: String(r8(open)), high: String(r8(high)), low: String(r8(low)), close: String(r8(close)),
        volume: String(r8(volume)), quoteVolume: String(r8(volume * close)),
        trades: Math.floor(Math.random() * 50), isClosed: true,
      });
      price = close;
    }
    await PriceCandle.bulkCreate(rows);
    total += rows.length;
    if (interval === '1h') h1 = rows;
    console.log(`   • ${interval}: ${rows.length} velas`);
  }

  // Derive the pair ticker (last price / 24h change / 24h volume) from the 1h series,
  // so the header shows real numbers instead of 0.00. Market-data only — no money-path.
  if (h1 && h1.length > 1) {
    const lastClose = Number(h1[h1.length - 1].close);
    const ref = h1[Math.max(0, h1.length - 24)]; // ~24h ago
    const refClose = Number(ref.close) || lastClose;
    const change24h = refClose > 0 ? ((lastClose - refClose) / refClose) * 100 : 0;
    const vol24h = h1.slice(-24).reduce((s, c) => s + Number(c.volume), 0);
    await pair.update({
      lastPrice: String(r8(lastClose)),
      priceChange24h: String(Number(change24h.toFixed(2))),
      volume24h: String(r8(vol24h)),
    });
    console.log(`   • ticker: last=${r8(lastClose)} 24h=${change24h.toFixed(2)}% vol=${r8(vol24h)}`);
  }

  console.log(`✅ ${total} velas sembradas para ${pair.symbol}. pairId=${pair.id}`);
  await sequelize.close();
  process.exit(0);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
