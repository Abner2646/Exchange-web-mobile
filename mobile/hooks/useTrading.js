// mobile/hooks/useTrading.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import tradingService from '../services/tradingService';
import api from '../services/api';

/**
 * Custom hook para manejar operaciones de trading spot
 */
const useTrading = (initialPairSymbol = 'BTC/USDT') => {
  // ==================== STATE ====================
  const [tradingPairs, setTradingPairs] = useState([]);
  const [activePair, setActivePair] = useState(null);
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [] });
  const [chartData, setChartData] = useState([]);
  const [recentTrades, setRecentTrades] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [tradingBalance, setTradingBalance] = useState([]);
  const [tickers, setTickers] = useState([]);

  const [loading, setLoading] = useState({
    pairs: false,
    orderBook: false,
    chart: false,
    trades: false,
    orders: false,
    balance: false,
  });

  const [errors, setErrors] = useState({});
  
  // Refs para intervalos
  const orderBookInterval = useRef(null);
  const tradesInterval = useRef(null);
  const tickersInterval = useRef(null);
  const tickersAvailable = useRef(true); // Verificar si el endpoint existe

  // ==================== TRADING PAIRS ====================

  const loadTradingPairs = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, pairs: true }));
      setErrors(prev => ({ ...prev, pairs: null }));
      
      console.log('🔄 === CARGANDO PARES DE TRADING ===');
      console.log('📍 URL completa:', `${api.defaults.baseURL}/trading/pairs/active`);
      
      const response = await tradingService.getActivePairs();
      
      console.log('📦 Response COMPLETA:', response);
      console.log('📦 Response type:', typeof response);
      console.log('📦 Response keys:', Object.keys(response || {}));
      
      let pairsData = [];
      
      if (response && response.success && Array.isArray(response.data)) {
        pairsData = response.data;
        console.log('✅ Formato: { success, data }');
      } else if (Array.isArray(response)) {
        pairsData = response;
        console.log('✅ Formato: Array directo');
      } else if (response && Array.isArray(response.pairs)) {
        pairsData = response.pairs;
        console.log('✅ Formato: { pairs }');
      } else {
        console.log('⚠️ Formato desconocido:', response);
      }
      
      pairsData = Array.isArray(pairsData) ? pairsData : [];
      
      console.log('✅ Pares procesados:', pairsData.length);
      if (pairsData.length > 0) {
        console.log('📊 Primer par:', pairsData[0]);
      } else {
        console.log('⚠️ No se encontraron pares en la respuesta');
      }
      
      setTradingPairs(pairsData);
      
      if (!activePair && pairsData.length > 0) {
        const initialPair = pairsData.find(p => p.symbol === initialPairSymbol) 
          || pairsData[0];
        console.log('🎯 Seleccionando par inicial:', initialPair);
        setActivePair(initialPair);
      }
      
    } catch (error) {
      console.error('❌ === ERROR CARGANDO PARES ===');
      console.error('❌ Error message:', error.message);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error completo:', error);
      
      setErrors(prev => ({ ...prev, pairs: error.message }));
      setTradingPairs([]);
      Alert.alert('Error', 'No se pudieron cargar los pares de trading');
    } finally {
      setLoading(prev => ({ ...prev, pairs: false }));
    }
  }, [activePair, initialPairSymbol]);

  const selectPair = useCallback((pair) => {
    setActivePair(pair);
    setOrderBook({ bids: [], asks: [] });
    setChartData([]);
    setRecentTrades([]);
  }, []);

  const loadTickers = useCallback(async () => {
    // Si ya sabemos que el endpoint no existe, no intentar cargarlo
    if (!tickersAvailable.current) return;
    
    try {
      const response = await tradingService.getTickers();
      
      let tickersData = [];
      
      if (response && response.success && Array.isArray(response.data)) {
        tickersData = response.data;
      } else if (Array.isArray(response)) {
        tickersData = response;
      } else if (response && typeof response === 'object') {
        tickersData = Object.values(response);
      }
      
      setTickers(Array.isArray(tickersData) ? tickersData : []);
      
    } catch (error) {
      // Si el endpoint no existe (404), marcar como no disponible y no volver a intentar
      if (error.response?.status === 404) {
        tickersAvailable.current = false;
        console.log('ℹ️ Endpoint de tickers no disponible - continuando sin tickers');
      } else {
        console.error('Error loading tickers:', error);
      }
      setTickers([]);
    }
  }, []);

  // ==================== ORDER BOOK ====================

  const loadOrderBook = useCallback(async (depth = 20) => {
    if (!activePair) return;

    try {
      setLoading(prev => ({ ...prev, orderBook: true }));
      setErrors(prev => ({ ...prev, orderBook: null }));

      const response = await tradingService.getOrderBook(activePair.id, depth);
      
      let orderBookData = { bids: [], asks: [] };
      
      if (response && response.success && response.data) {
        orderBookData = response.data;
      } else if (response && (response.bids || response.asks)) {
        orderBookData = response;
      }
      
      setOrderBook({
        bids: Array.isArray(orderBookData.bids) ? orderBookData.bids : [],
        asks: Array.isArray(orderBookData.asks) ? orderBookData.asks : []
      });
      
    } catch (error) {
      console.error('Error loading order book:', error);
      setErrors(prev => ({ ...prev, orderBook: error.message }));
      setOrderBook({ bids: [], asks: [] });
    } finally {
      setLoading(prev => ({ ...prev, orderBook: false }));
    }
  }, [activePair]);

  // ==================== CHART DATA ====================

  const loadChartData = useCallback(async (interval = '1h', filters = {}) => {
    if (!activePair) return;

    try {
      setLoading(prev => ({ ...prev, chart: true }));
      setErrors(prev => ({ ...prev, chart: null }));

      const response = await tradingService.getChartData(
        activePair.id, 
        interval, 
        filters
      );
      
      let chartDataRaw = [];
      
      if (response && response.success && Array.isArray(response.candles)) {
        chartDataRaw = response.candles;
      } else if (response && Array.isArray(response.data)) {
        chartDataRaw = response.data;
      } else if (Array.isArray(response)) {
        chartDataRaw = response;
      }
      
      const formattedData = chartDataRaw.map(candle => ({
        time: Math.floor((candle.time || candle.openTime) / 1000),
        open: parseFloat(candle.open || 0),
        high: parseFloat(candle.high || 0),
        low: parseFloat(candle.low || 0),
        close: parseFloat(candle.close || 0),
        volume: parseFloat(candle.volume || 0),
      }));
      
      setChartData(formattedData);
      
    } catch (error) {
      console.error('Error loading chart data:', error);
      setErrors(prev => ({ ...prev, chart: error.message }));
      setChartData([]);
      
      // Fallback a Binance
      try {
        const binanceResponse = await tradingService.getBinanceChartData(
          activePair.id,
          interval,
          filters
        );
        
        let binanceData = [];
        if (binanceResponse && binanceResponse.success && Array.isArray(binanceResponse.candles)) {
          binanceData = binanceResponse.candles;
        } else if (binanceResponse && Array.isArray(binanceResponse.data)) {
          binanceData = binanceResponse.data;
        } else if (Array.isArray(binanceResponse)) {
          binanceData = binanceResponse;
        }
        
        const formattedData = binanceData.map(candle => ({
          time: Math.floor((candle.time || candle.openTime) / 1000),
          open: parseFloat(candle.open || 0),
          high: parseFloat(candle.high || 0),
          low: parseFloat(candle.low || 0),
          close: parseFloat(candle.close || 0),
          volume: parseFloat(candle.volume || 0),
        }));
        
        setChartData(formattedData);
      } catch (binanceError) {
        console.error('Error loading Binance data:', binanceError);
      }
    } finally {
      setLoading(prev => ({ ...prev, chart: false }));
    }
  }, [activePair]);

  // ==================== TRADES ====================

  const loadRecentTrades = useCallback(async (limit = 50) => {
    if (!activePair) return;

    try {
      setLoading(prev => ({ ...prev, trades: true }));
      setErrors(prev => ({ ...prev, trades: null }));

      const response = await tradingService.getRecentTrades(activePair.id, limit);
      
      let tradesData = [];
      
      if (response && response.success && Array.isArray(response.data)) {
        tradesData = response.data;
      } else if (Array.isArray(response)) {
        tradesData = response;
      }
      
      setRecentTrades(tradesData);
      
    } catch (error) {
      console.error('Error loading recent trades:', error);
      setErrors(prev => ({ ...prev, trades: error.message }));
      setRecentTrades([]);
    } finally {
      setLoading(prev => ({ ...prev, trades: false }));
    }
  }, [activePair]);

  // ==================== ORDERS ====================

  const createOrder = useCallback(async (orderData) => {
    try {
      setLoading(prev => ({ ...prev, orders: true }));
      setErrors(prev => ({ ...prev, orders: null }));

      const response = await tradingService.createOrder({
        ...orderData,
        tradingPairId: activePair.id,
      });
      
      if (response && response.success) {
        await loadActiveOrders();
        await loadTradingBalance();
        return { success: true, data: response.data };
      }
      
      return { success: false, error: response?.message || 'Error desconocido' };
    } catch (error) {
      console.error('Error creating order:', error);
      setErrors(prev => ({ ...prev, orders: error.message }));
      return { success: false, error: error.message };
    } finally {
      setLoading(prev => ({ ...prev, orders: false }));
    }
  }, [activePair]);

  const cancelOrder = useCallback(async (orderId) => {
    try {
      const response = await tradingService.cancelOrder(orderId);
      
      if (response && response.success) {
        await loadActiveOrders();
        await loadTradingBalance();
        return { success: true };
      }
      
      return { success: false, error: response?.message || 'Error desconocido' };
    } catch (error) {
      console.error('Error cancelling order:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const loadActiveOrders = useCallback(async () => {
    try {
      const response = await tradingService.getActiveOrders();
      
      let ordersData = [];
      
      if (response && response.success && Array.isArray(response.data)) {
        ordersData = response.data;
      } else if (Array.isArray(response)) {
        ordersData = response;
      } else if (response && Array.isArray(response.orders)) {
        ordersData = response.orders;
      }
      
      setActiveOrders(ordersData);
      
    } catch (error) {
      console.error('Error loading active orders:', error);
      setActiveOrders([]);
    }
  }, []);

  // ==================== BALANCE ====================

  const loadTradingBalance = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, balance: true }));
      
      const response = await tradingService.getTradingBalance();
      
      let balanceData = [];
      
      if (response && response.success && Array.isArray(response.data)) {
        balanceData = response.data;
      } else if (Array.isArray(response)) {
        balanceData = response;
      } else if (response && Array.isArray(response.balances)) {
        balanceData = response.balances;
      }
      
      setTradingBalance(Array.isArray(balanceData) ? balanceData : []);
      
    } catch (error) {
      console.error('Error loading trading balance:', error);
      setTradingBalance([]);
    } finally {
      setLoading(prev => ({ ...prev, balance: false }));
    }
  }, []);

  // ==================== REAL-TIME UPDATES ====================

  const startRealTimeUpdates = useCallback(() => {
    orderBookInterval.current = setInterval(() => {
      loadOrderBook();
    }, 3000); // Cada 3 segundos en mobile

    tradesInterval.current = setInterval(() => {
      loadRecentTrades();
    }, 5000); // Cada 5 segundos en mobile

    // Solo iniciar intervalo de tickers si el endpoint está disponible
    if (tickersAvailable.current) {
      tickersInterval.current = setInterval(() => {
        loadTickers();
      }, 8000); // Cada 8 segundos en mobile
    }
  }, [loadOrderBook, loadRecentTrades, loadTickers]);

  const stopRealTimeUpdates = useCallback(() => {
    if (orderBookInterval.current) {
      clearInterval(orderBookInterval.current);
      orderBookInterval.current = null;
    }
    if (tradesInterval.current) {
      clearInterval(tradesInterval.current);
      tradesInterval.current = null;
    }
    if (tickersInterval.current) {
      clearInterval(tickersInterval.current);
      tickersInterval.current = null;
    }
  }, []);

  // ==================== EFFECTS ====================

  useEffect(() => {
    loadTradingPairs();
    loadTradingBalance();
  }, []);

  useEffect(() => {
    if (activePair) {
      loadOrderBook();
      loadChartData();
      loadRecentTrades();
      loadActiveOrders();
    }
  }, [activePair]);

  useEffect(() => {
    return () => {
      stopRealTimeUpdates();
    };
  }, [stopRealTimeUpdates]);

  // ==================== RETURN ====================

  return {
    tradingPairs,
    activePair,
    orderBook,
    chartData,
    recentTrades,
    activeOrders,
    tradingBalance,
    tickers,
    loading,
    errors,
    selectPair,
    loadTradingPairs,
    loadOrderBook,
    loadChartData,
    loadRecentTrades,
    createOrder,
    cancelOrder,
    loadActiveOrders,
    loadTradingBalance,
    loadTickers,
    startRealTimeUpdates,
    stopRealTimeUpdates,
  };
};

export default useTrading;