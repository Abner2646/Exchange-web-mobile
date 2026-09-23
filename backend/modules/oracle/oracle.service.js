const defaultSources = require('./oracle.sources');
const money = require('../../utils/money');
const AppError = require('../../utils/AppError');

// A usable oracle price must be a finite, strictly-positive decimal. A source that
// returns "0", "NaN", a negative, or a non-numeric string is treated as unavailable —
// otherwise the bad value corrupts the median, divides-by-zero in the divergence
// ratio, or (as NaN) silently bypasses the circuit breaker and is reported reliable.
function isValidPrice(p) {
  if (p === null || p === undefined) return false;
  const n = Number(p);
  if (!Number.isFinite(n)) return false;
  return money.compare(String(p), '0') > 0;
}

class OracleService {
  constructor(sources = defaultSources, divergenceThreshold = '1.5') {
    this.sources = [
      { name: 'Binance', fetcher: sources.fetchBinance },
      { name: 'Coinbase', fetcher: sources.fetchCoinbase },
      { name: 'CoinGecko', fetcher: sources.fetchCoinGecko }
    ];
    this.divergenceThreshold = String(divergenceThreshold);
  }

  async getPrice(symbol) {
    const promises = this.sources.map(async (source) => {
      try {
        const price = await source.fetcher(symbol);
        if (!isValidPrice(price)) {
          return { name: source.name, price: null, ok: false, error: `invalid price: ${price}` };
        }
        return { name: source.name, price, ok: true };
      } catch (error) {
        return { name: source.name, price: null, ok: false, error: error.message };
      }
    });

    const results = await Promise.all(promises);
    const successful = results.filter(r => r.ok);

    if (successful.length < 2) {
      throw new AppError(503, 'ORACLE_UNAVAILABLE', 'Insufficient oracle sources available');
    }

    const prices = successful.map(r => r.price).sort((a, b) => money.compare(a, b));
    let median;

    if (prices.length === 3) {
      median = prices[1];
    } else {
      median = money.divide(money.add(prices[0], prices[1]), '2');
    }

    const min = prices[0];
    const max = prices[prices.length - 1];

    const divergenceRatio = money.divide(money.subtract(max, min), min);
    const divergencePct = money.multiply(divergenceRatio, '100');

    // Fail-safe: a non-finite divergence (should be impossible now that all prices are
    // validated positive) is treated as divergent rather than silently reliable.
    const isDivergent = !Number.isFinite(Number(divergencePct))
      || money.compare(divergencePct, this.divergenceThreshold) > 0;

    let reliable = true;
    let reason = null;

    if (isDivergent) {
      reliable = false;
      reason = `Divergence circuit breaker triggered: spread between min and max price (${divergencePct}%) exceeds threshold of ${this.divergenceThreshold}%`;
    }

    return {
      symbol: symbol.toUpperCase(),
      price: median, // return median as the final agreed price
      median,
      sources: results.map(({ name, price, ok }) => ({ name, price, ok })),
      divergencePct,
      reliable,
      reason
    };
  }
}

module.exports = OracleService;
