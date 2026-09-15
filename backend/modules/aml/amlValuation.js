// backend/modules/aml/amlValuation.js
// Best-effort USD valuation for AML value-based signals. Built on SwapPair.currentPrice
// (base priced in quote) + the USD-stable-quote convention already used in the swap
// pricing code. No cross-quote chaining: an asset with no direct stable pair is
// 'unknown' (the caller records it rather than silently missing it).
const money = require('../../utils/money');

const STABLE_SYMBOLS = ['USDT', 'USDC', 'USD', 'DAI'];

async function getUsdValue(cryptoId, amount, transaction = null) {
  const { Crypto, SwapPair } = require('../../models');
  const crypto = await Crypto.findByPk(cryptoId, { transaction });
  if (!crypto) return { usd: null, priceAsOf: null, source: 'unknown' };

  if (STABLE_SYMBOLS.includes(crypto.symbol)) {
    return { usd: String(amount), priceAsOf: new Date(), source: 'stable' };
  }

  const pairs = await SwapPair.findAll({ where: { baseCryptoId: cryptoId, active: true }, transaction });
  for (const pair of pairs) {
    // A stale/corrupt price ≤ 0 would value the asset at $0 (or nonsense) and
    // silently under-count a value-based signal — treat it as no usable price
    // rather than trusting it. Better 'unknown' (recorded) than a $0 AML miss.
    if (money.compare(String(pair.currentPrice), '0') <= 0) continue;
    const quote = await Crypto.findByPk(pair.quoteCryptoId, { transaction });
    if (quote && STABLE_SYMBOLS.includes(quote.symbol)) {
      return {
        usd: money.multiply(String(amount), String(pair.currentPrice)),
        priceAsOf: pair.lastUpdated || null,
        source: 'pair',
      };
    }
  }
  return { usd: null, priceAsOf: null, source: 'unknown' };
}

module.exports = { STABLE_SYMBOLS, getUsdValue };
