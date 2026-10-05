const axios = require('axios');

async function fetchBinance(symbol) {
  try {
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol.toUpperCase()}`;
    const res = await axios.get(url, { timeout: 5000 });
    if (res.data && res.data.price) {
      return String(res.data.price);
    }
    throw new Error('Invalid Binance response format');
  } catch (error) {
    throw new Error(`Binance fetch failed: ${error.message}`);
  }
}

async function fetchCoinbase(symbol) {
  try {
    const base = symbol.toUpperCase().replace(/USDT$/, '').replace(/USD$/, '');
    const url = `https://api.coinbase.com/v2/prices/${base}-USD/spot`;
    const res = await axios.get(url, { timeout: 5000 });
    if (res.data && res.data.data && res.data.data.amount) {
      return String(res.data.data.amount);
    }
    throw new Error('Invalid Coinbase response format');
  } catch (error) {
    throw new Error(`Coinbase fetch failed: ${error.message}`);
  }
}

// CoinGecko ids keyed by the external (Binance-style) ticker. Binance + Coinbase
// cover these too, so a missing entry here only drops the oracle from 3 sources to 2
// (still a valid median); an entry restores 3-source robustness. Extend as the
// catalog grows — never silently default an unknown symbol to a wrong asset.
const COINGECKO_SYMBOL_MAP = {
  'BTCUSDT': 'bitcoin',
  'ETHUSDT': 'ethereum',
  'LTCUSDT': 'litecoin',
  'BNBUSDT': 'binancecoin',
  'SOLUSDT': 'solana',
  'XRPUSDT': 'ripple',
  'ADAUSDT': 'cardano',
  'DOGEUSDT': 'dogecoin',
  'DOTUSDT': 'polkadot',
  'MATICUSDT': 'matic-network',
  'AVAXUSDT': 'avalanche-2',
  'LINKUSDT': 'chainlink',
  'TRXUSDT': 'tron',
  'UNIUSDT': 'uniswap',
  'ATOMUSDT': 'cosmos',
  'XLMUSDT': 'stellar',
  'BCHUSDT': 'bitcoin-cash',
  'SHIBUSDT': 'shiba-inu',
  'ARBUSDT': 'arbitrum',
  'OPUSDT': 'optimism',
};

async function fetchCoinGecko(symbol) {
  try {
    const id = COINGECKO_SYMBOL_MAP[symbol.toUpperCase()];
    if (!id) {
      // Never silently fall back to a default asset: returning BTC's price for an
      // unmapped symbol would feed a wrong price into the median. Fail loudly.
      throw new Error(`Unsupported CoinGecko symbol: ${symbol}`);
    }
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`;
    const res = await axios.get(url, { timeout: 5000 });
    if (res.data && res.data[id] && res.data[id].usd) {
      return String(res.data[id].usd);
    }
    throw new Error('Invalid CoinGecko response format');
  } catch (error) {
    throw new Error(`CoinGecko fetch failed: ${error.message}`);
  }
}

module.exports = {
  fetchBinance,
  fetchCoinbase,
  fetchCoinGecko
};
