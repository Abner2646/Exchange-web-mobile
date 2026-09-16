// backend/modules/aml/amlValuation.js
// Best-effort USD valuation for AML value-based signals. Built on SwapPair.currentPrice
// (base priced in quote) + the USD-stable-quote convention already used in the swap
// pricing code. No cross-quote chaining: an asset with no direct stable pair is
// 'unknown' (the caller records it rather than silently missing it).
const money = require('../../utils/money');

const STABLE_SYMBOLS = ['USDT', 'USDC', 'USD', 'DAI'];

// Emit a console.warn when the best usable price is older than this threshold so
// a stale feed is visible in logs without silently producing an AML miss.
const STALE_PRICE_THRESHOLD_MS = 3600 * 1000; // 1 hour

async function getUsdValue(cryptoId, amount, transaction = null) {
  const { Crypto, SwapPair } = require('../../models');
  const crypto = await Crypto.findByPk(cryptoId, { transaction });
  if (!crypto) return { usd: null, priceAsOf: null, source: 'unknown' };

  if (STABLE_SYMBOLS.includes(crypto.symbol)) {
    return { usd: String(amount), priceAsOf: new Date(), source: 'stable' };
  }

  const pairs = await SwapPair.findAll({ where: { baseCryptoId: cryptoId, active: true }, transaction });
  if (pairs.length === 0) return { usd: null, priceAsOf: null, source: 'unknown' };

  // Batch-load all quote cryptos in one query instead of N findByPk calls.
  const quoteIds = [...new Set(pairs.map(p => p.quoteCryptoId))];
  const quoteRows = await Crypto.findAll({ where: { id: quoteIds }, transaction });
  const quoteById = Object.fromEntries(quoteRows.map(c => [c.id, c]));

  for (const pair of pairs) {
    // A stale/corrupt price ≤ 0 would value the asset at $0 (or nonsense) and
    // silently under-count a value-based signal — treat it as no usable price
    // rather than trusting it. Better 'unknown' (recorded) than a $0 AML miss.
    if (money.compare(String(pair.currentPrice), '0') <= 0) continue;
    const quote = quoteById[pair.quoteCryptoId];
    if (quote && STABLE_SYMBOLS.includes(quote.symbol)) {
      const priceAsOf = pair.lastUpdated || null;
      if (priceAsOf && Date.now() - new Date(priceAsOf).getTime() > STALE_PRICE_THRESHOLD_MS) {
        console.warn(`[amlValuation] stale price for cryptoId=${cryptoId} (last updated ${new Date(priceAsOf).toISOString()}) — AML valuation may undercount`);
      }
      return {
        usd: money.multiply(String(amount), String(pair.currentPrice)),
        priceAsOf,
        source: 'pair',
      };
    }
  }
  return { usd: null, priceAsOf: null, source: 'unknown' };
}

module.exports = { STABLE_SYMBOLS, getUsdValue };
