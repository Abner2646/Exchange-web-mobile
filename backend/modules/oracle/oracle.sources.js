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

async function fetchCoinGecko(symbol) {
  try {
    const symbolMap = {
      'BTCUSDT': 'bitcoin',
      'ETHUSDT': 'ethereum',
      'LTCUSDT': 'litecoin'
    };
    const id = symbolMap[symbol.toUpperCase()];
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
