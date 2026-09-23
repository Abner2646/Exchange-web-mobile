const defaultSources = require('./oracle.sources');
const money = require('../../utils/money');
const AppError = require('../../utils/AppError');

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

    const isDivergent = money.compare(divergencePct, this.divergenceThreshold) > 0;

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
