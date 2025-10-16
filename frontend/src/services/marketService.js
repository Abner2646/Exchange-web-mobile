// src/services/marketService.js
import axios from 'axios';
import { ENDPOINTS } from '../api/endpoints';

class MarketService {
  // Obtener datos del mercado (CoinGecko)
  async getMarketData(page = 1, perPage = 10) {
    const response = await axios.get(
      ENDPOINTS.COINGECKO_MARKETS(page, perPage)
    );
    return response.data;
  }
}

export default new MarketService();