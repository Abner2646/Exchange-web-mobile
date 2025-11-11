// src/services/tradingService.js (web)
import apiClient from '../api/client';
import { TRADING_ENDPOINTS } from '../api/endpoints'; // ✅ Importar TRADING_ENDPOINTS

const tradingService = {
  async getAllPairs(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await apiClient.get(`${TRADING_ENDPOINTS.PAIRS}?${params}`); // ✅ Usar TRADING_ENDPOINTS
    return response.data;
  },

  async getActivePairs() {
    const response = await apiClient.get(TRADING_ENDPOINTS.PAIRS_ACTIVE); // ✅ Usar TRADING_ENDPOINTS
    return response.data;
  },

  /**
   * Obtener un par por símbolo (ej: BTC/USDT)
   */
  async getPairBySymbol(symbol) {
    const response = await apiClient.get(TRADING_ENDPOINTS.PAIR_BY_SYMBOL(symbol));
    return response.data;
  },

  /**
   * Obtener detalle de un par
   */
  async getPairById(pairId) {
    const response = await apiClient.get(TRADING_ENDPOINTS.PAIR_DETAIL(pairId));
    return response.data;
  },

  /**
   * Obtener top pares por volumen
   */
  async getTopPairs(limit = 10) {
    const response = await apiClient.get(`${TRADING_ENDPOINTS.PAIRS_TOP}?limit=${limit}`);
    return response.data;
  },

  /**
   * Obtener todos los tickers en tiempo real
   */
  async getTickers() {
    const response = await apiClient.get(TRADING_ENDPOINTS.TICKERS);
    return response.data;
  },

  // ==================== ORDERS ====================

  /**
   * Crear una orden de trading
   */
  async createOrder(orderData) {
    const response = await apiClient.post(TRADING_ENDPOINTS.CREATE_ORDER, orderData);
    return response.data;
  },

  /**
   * Cancelar una orden
   */
  async cancelOrder(orderId) {
    const response = await apiClient.delete(TRADING_ENDPOINTS.CANCEL_ORDER(orderId));
    return response.data;
  },

  /**
   * Obtener órdenes del usuario con filtros
   */
  async getUserOrders(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await apiClient.get(`${TRADING_ENDPOINTS.USER_ORDERS}?${params}`);
    return response.data;
  },

  /**
   * Obtener órdenes activas del usuario
   */
  async getActiveOrders() {
    const response = await apiClient.get(TRADING_ENDPOINTS.ACTIVE_ORDERS);
    return response.data;
  },

  /**
   * Obtener detalle de una orden
   */
  async getOrderById(orderId) {
    const response = await apiClient.get(TRADING_ENDPOINTS.ORDER_DETAIL(orderId));
    return response.data;
  },

  // ==================== ORDER BOOK ====================

  /**
   * Obtener order book de un par
   */
  async getOrderBook(tradingPairId, depth = 20) {
    const response = await apiClient.get(
      `${TRADING_ENDPOINTS.ORDER_BOOK(tradingPairId)}?depth=${depth}`
    );
    return response.data;
  },

  /**
   * Obtener estadísticas del order book
   */
  async getOrderBookStats(tradingPairId) {
    const response = await apiClient.get(TRADING_ENDPOINTS.ORDER_BOOK_STATS(tradingPairId));
    return response.data;
  },

  /**
   * Obtener spread bid/ask
   */
  async getSpread(tradingPairId) {
    const response = await apiClient.get(TRADING_ENDPOINTS.SPREAD(tradingPairId));
    return response.data;
  },

  // ==================== TRADES ====================

  /**
   * Obtener trades recientes de un par
   */
  async getRecentTrades(tradingPairId, limit = 50) {
    const response = await apiClient.get(
      `${TRADING_ENDPOINTS.RECENT_TRADES(tradingPairId)}?limit=${limit}`
    );
    return response.data;
  },

  /**
   * Obtener trades del usuario
   */
  async getUserTrades(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await apiClient.get(`${TRADING_ENDPOINTS.USER_TRADES}?${params}`);
    return response.data;
  },

  /**
   * Obtener estadísticas de trading del usuario
   */
  async getUserTradeStats(tradingPairId = null) {
    const url = tradingPairId 
      ? `${TRADING_ENDPOINTS.USER_TRADE_STATS}?tradingPairId=${tradingPairId}`
      : TRADING_ENDPOINTS.USER_TRADE_STATS;
    const response = await apiClient.get(url);
    return response.data;
  },

  /**
   * Obtener detalle de un trade
   */
  async getTradeDetail(tradeId) {
    const response = await apiClient.get(TRADING_ENDPOINTS.TRADE_DETAIL(tradeId));
    return response.data;
  },

  // ==================== CHART DATA ====================

  /**
   * Obtener datos OHLCV para gráficos (propios)
   */
  async getChartData(tradingPairId, interval = '1h', filters = {}) {
    const params = new URLSearchParams({ interval, ...filters });
    const response = await apiClient.get(
      `${TRADING_ENDPOINTS.CHART_DATA(tradingPairId)}?${params}`
    );
    return response.data;
  },

  /**
   * Obtener datos de Binance (fallback)
   */
  async getBinanceChartData(tradingPairId, interval = '1h', filters = {}) {
    const params = new URLSearchParams({ interval, ...filters });
    const response = await apiClient.get(
      `${TRADING_ENDPOINTS.CHART_DATA_BINANCE(tradingPairId)}?${params}`
    );
    return response.data;
  },

  // ==================== STATISTICS ====================

  /**
   * Obtener estadísticas de un par
   */
  async getPairStats(tradingPairId, timeRange = '24h') {
    const response = await apiClient.get(
      `${TRADING_ENDPOINTS.PAIR_STATS(tradingPairId)}?timeRange=${timeRange}`
    );
    return response.data;
  },

  /**
   * Obtener volumen de todos los pares
   */
  async getVolume(timeRange = '24h') {
    const response = await apiClient.get(
      `${TRADING_ENDPOINTS.VOLUME}?timeRange=${timeRange}`
    );
    return response.data;
  },

  /**
   * Obtener resumen de trading del usuario
   */
  async getUserSummary() {
    const response = await apiClient.get(TRADING_ENDPOINTS.USER_SUMMARY);
    return response.data;
  },

  // ==================== BALANCE ====================

  /**
   * Obtener balance de trading del usuario
   */
  async getTradingBalance() {
    const response = await apiClient.get(TRADING_ENDPOINTS.BALANCE);
    return response.data;
  },
};

export default tradingService;