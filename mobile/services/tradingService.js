// mobile/services/tradingService.js
import api from './api';
import { TRADING_ENDPOINTS } from '../api/endpoints';

const tradingService = {
  // ==================== TRADING PAIRS ====================

  async getAllPairs(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await api.get(`${TRADING_ENDPOINTS.PAIRS}?${params}`);
    return response.data;
  },

  async getActivePairs() {
    const response = await api.get(TRADING_ENDPOINTS.PAIRS_ACTIVE);
    return response.data;
  },

  async getPairBySymbol(symbol) {
    const response = await api.get(TRADING_ENDPOINTS.PAIR_BY_SYMBOL(symbol));
    return response.data;
  },

  async getPairById(pairId) {
    const response = await api.get(TRADING_ENDPOINTS.PAIR_DETAIL(pairId));
    return response.data;
  },

  async getTopPairs(limit = 10) {
    const response = await api.get(`${TRADING_ENDPOINTS.PAIRS_TOP}?limit=${limit}`);
    return response.data;
  },

  async getTickers() {
    const response = await api.get(TRADING_ENDPOINTS.TICKERS);
    return response.data;
  },

  // ==================== ORDERS ====================

  async createOrder(orderData) {
    const response = await api.post(TRADING_ENDPOINTS.CREATE_ORDER, orderData);
    return response.data;
  },

  async cancelOrder(orderId) {
    const response = await api.delete(TRADING_ENDPOINTS.CANCEL_ORDER(orderId));
    return response.data;
  },

  async getUserOrders(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await api.get(`${TRADING_ENDPOINTS.USER_ORDERS}?${params}`);
    return response.data;
  },

  async getActiveOrders() {
    const response = await api.get(TRADING_ENDPOINTS.ACTIVE_ORDERS);
    return response.data;
  },

  async getOrderById(orderId) {
    const response = await api.get(TRADING_ENDPOINTS.ORDER_DETAIL(orderId));
    return response.data;
  },

  // ==================== ORDER BOOK ====================

  async getOrderBook(tradingPairId, depth = 20) {
    const response = await api.get(
      `${TRADING_ENDPOINTS.ORDER_BOOK(tradingPairId)}?depth=${depth}`
    );
    return response.data;
  },

  async getOrderBookStats(tradingPairId) {
    const response = await api.get(TRADING_ENDPOINTS.ORDER_BOOK_STATS(tradingPairId));
    return response.data;
  },

  async getSpread(tradingPairId) {
    const response = await api.get(TRADING_ENDPOINTS.SPREAD(tradingPairId));
    return response.data;
  },

  // ==================== TRADES ====================

  async getRecentTrades(tradingPairId, limit = 50) {
    const response = await api.get(
      `${TRADING_ENDPOINTS.RECENT_TRADES(tradingPairId)}?limit=${limit}`
    );
    return response.data;
  },

  async getUserTrades(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await api.get(`${TRADING_ENDPOINTS.USER_TRADES}?${params}`);
    return response.data;
  },

  async getUserTradeStats(tradingPairId = null) {
    const url = tradingPairId 
      ? `${TRADING_ENDPOINTS.USER_TRADE_STATS}?tradingPairId=${tradingPairId}`
      : TRADING_ENDPOINTS.USER_TRADE_STATS;
    const response = await api.get(url);
    return response.data;
  },

  async getTradeDetail(tradeId) {
    const response = await api.get(TRADING_ENDPOINTS.TRADE_DETAIL(tradeId));
    return response.data;
  },

  // ==================== CHART DATA ====================

  async getChartData(tradingPairId, interval = '1h', filters = {}) {
    const params = new URLSearchParams({ interval, ...filters });
    const response = await api.get(
      `${TRADING_ENDPOINTS.CHART_DATA(tradingPairId)}?${params}`
    );
    return response.data;
  },

  async getBinanceChartData(tradingPairId, interval = '1h', filters = {}) {
    const params = new URLSearchParams({ interval, ...filters });
    const response = await api.get(
      `${TRADING_ENDPOINTS.CHART_DATA_BINANCE(tradingPairId)}?${params}`
    );
    return response.data;
  },

  // ==================== STATISTICS ====================

  async getPairStats(tradingPairId, timeRange = '24h') {
    const response = await api.get(
      `${TRADING_ENDPOINTS.PAIR_STATS(tradingPairId)}?timeRange=${timeRange}`
    );
    return response.data;
  },

  async getVolume(timeRange = '24h') {
    const response = await api.get(
      `${TRADING_ENDPOINTS.VOLUME}?timeRange=${timeRange}`
    );
    return response.data;
  },

  async getUserSummary() {
    const response = await api.get(TRADING_ENDPOINTS.USER_SUMMARY);
    return response.data;
  },

  // ==================== BALANCE ====================

  async getTradingBalance() {
    const response = await api.get(TRADING_ENDPOINTS.BALANCE);
    return response.data;
  },
};

export default tradingService;