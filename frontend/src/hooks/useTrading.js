// src/hooks/useTrading.js (web)
import { useState, useEffect, useCallback, useRef } from 'react';
import tradingService from '../services/tradingService';

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
  const [userOrders, setUserOrders] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [userTrades, setUserTrades] = useState([]);
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

  // ==================== TRADING PAIRS ====================

  /**
   * Cargar todos los pares de trading
   */
  // src/hooks/useTrading.js - función loadTradingPairs

const loadTradingPairs = useCallback(async () => {
  try {
    setLoading(prev => ({ ...prev, pairs: true }));
    setErrors(prev => ({ ...prev, pairs: null }));
    
    console.log('🔄 Cargando pares de trading...');
    const response = await tradingService.getActivePairs();
    console.log('📦 Response de pares:', response);
    
    let pairsData = [];
    
    if (response && response.success && Array.isArray(response.data)) {
      pairsData = response.data;
    } else if (Array.isArray(response)) {
      pairsData = response;
    } else if (response && Array.isArray(response.pairs)) {
      pairsData = response.pairs;
    }
    
    pairsData = Array.isArray(pairsData) ? pairsData : [];
    
    console.log('✅ Pares procesados:', pairsData.length);
    if (pairsData.length > 0) {
      console.log('📊 Primer par:', pairsData[0]);
    }
    
    setTradingPairs(pairsData);
    
    if (!activePair && pairsData.length > 0) {
      const initialPair = pairsData.find(p => p.symbol === initialPairSymbol) 
        || pairsData[0];
      console.log('🎯 Seleccionando par inicial:', initialPair);
      setActivePair(initialPair);
    }
    
  } catch (error) {
    console.error('❌ Error loading trading pairs:', error);
    setErrors(prev => ({ ...prev, pairs: error.message }));
    setTradingPairs([]);
  } finally {
    setLoading(prev => ({ ...prev, pairs: false }));
  }
}, [activePair, initialPairSymbol]);

  /**
   * Seleccionar un par de trading
   */
  const selectPair = useCallback((pair) => {
    setActivePair(pair);
    // Limpiar datos del par anterior
    setOrderBook({ bids: [], asks: [] });
    setChartData([]);
    setRecentTrades([]);
  }, []);

  /**
   * Cargar tickers en tiempo real
   */
  const loadTickers = useCallback(async () => {
    try {
      const response = await tradingService.getTickers();
      
      // ✅ MANEJO SEGURO DE LA RESPUESTA
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
      console.error('Error loading tickers:', error);
      setTickers([]); // ✅ ARRAY VACÍO EN CASO DE ERROR
    }
  }, []);

  // ==================== ORDER BOOK ====================

  /**
   * Cargar order book
   */
const loadOrderBook = useCallback(async (depth = 20) => {
  if (!activePair) {
    console.log('⚠️ No hay par activo para order book');
    return;
  }

  try {
    setLoading(prev => ({ ...prev, orderBook: true }));
    setErrors(prev => ({ ...prev, orderBook: null }));

    console.log('📖 === CARGANDO ORDER BOOK ===');
    console.log('🎯 Pair:', activePair.symbol);
    console.log('🆔 Pair ID:', activePair.id);
    console.log('📏 Depth:', depth);

    const response = await tradingService.getOrderBook(activePair.id, depth);
    
    console.log('📦 Response COMPLETA de Order Book:', response);
    console.log('📦 Response JSON:', JSON.stringify(response, null, 2));
    
    let orderBookData = { bids: [], asks: [] };
    
    if (response && response.success && response.data) {
      orderBookData = response.data;
    } else if (response && (response.bids || response.asks)) {
      orderBookData = response;
    }
    
    console.log('✅ Order Book procesado:');
    console.log('  📗 Bids:', orderBookData.bids?.length || 0);
    console.log('  📕 Asks:', orderBookData.asks?.length || 0);
    
    if (orderBookData.bids?.length > 0) {
      console.log('  📗 Primer bid:', orderBookData.bids[0]);
    }
    if (orderBookData.asks?.length > 0) {
      console.log('  📕 Primer ask:', orderBookData.asks[0]);
    }
    
    setOrderBook({
      bids: Array.isArray(orderBookData.bids) ? orderBookData.bids : [],
      asks: Array.isArray(orderBookData.asks) ? orderBookData.asks : []
    });
    
  } catch (error) {
    console.error('❌ Error loading order book:', error);
    console.error('❌ Error completo:', error.response?.data || error.message);
    setErrors(prev => ({ ...prev, orderBook: error.message }));
    setOrderBook({ bids: [], asks: [] });
  } finally {
    setLoading(prev => ({ ...prev, orderBook: false }));
  }
}, [activePair]);

  // ==================== CHART DATA ====================

  /**
   * Cargar datos del gráfico
   */
const loadChartData = useCallback(async (interval = '1h', filters = {}) => {
  if (!activePair) {
    console.log('⚠️ No hay par activo');
    return;
  }

  try {
    setLoading(prev => ({ ...prev, chart: true }));
    setErrors(prev => ({ ...prev, chart: null }));

    console.log('📈 Cargando chart data para:', activePair.symbol);
    
    const response = await tradingService.getChartData(
      activePair.id, 
      interval, 
      filters
    );
    
    console.log('📦 Response de chart:', response);
    
    let chartDataRaw = [];
    
    // ✅ CORRECCIÓN: El backend devuelve los datos en 'candles', no en 'data'
    if (response && response.success && Array.isArray(response.candles)) {
      chartDataRaw = response.candles;
    } else if (response && Array.isArray(response.data)) {
      chartDataRaw = response.data;
    } else if (Array.isArray(response)) {
      chartDataRaw = response;
    }
    
    console.log('📊 Velas encontradas:', chartDataRaw.length);
    
    // Convertir datos al formato de Lightweight Charts
    const formattedData = chartDataRaw.map(candle => ({
      time: Math.floor((candle.time || candle.openTime) / 1000), // Ya viene en ms
      open: parseFloat(candle.open || 0),
      high: parseFloat(candle.high || 0),
      low: parseFloat(candle.low || 0),
      close: parseFloat(candle.close || 0),
      volume: parseFloat(candle.volume || 0),
    }));
    
    console.log('✅ Chart data formateada:', formattedData.length);
    if (formattedData.length > 0) {
      console.log('📊 Primera vela:', formattedData[0]);
    }
    
    setChartData(formattedData);
    
  } catch (error) {
    console.error('❌ Error loading chart data:', error);
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
      
      console.log('✅ Binance data cargada:', formattedData.length);
      setChartData(formattedData);
    } catch (binanceError) {
      console.error('❌ Error loading Binance data:', binanceError);
    }
  } finally {
    setLoading(prev => ({ ...prev, chart: false }));
  }
}, [activePair]);

  // ==================== TRADES ====================

  /**
   * Cargar trades recientes del par
   */
  const loadRecentTrades = useCallback(async (limit = 50) => {
    if (!activePair) return;

    try {
      setLoading(prev => ({ ...prev, trades: true }));
      setErrors(prev => ({ ...prev, trades: null }));

      const response = await tradingService.getRecentTrades(activePair.id, limit);
      
      // ✅ MANEJO SEGURO DE LA RESPUESTA
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
      setRecentTrades([]); // ✅ RESET EN CASO DE ERROR
    } finally {
      setLoading(prev => ({ ...prev, trades: false }));
    }
  }, [activePair]);

  /**
   * Cargar trades del usuario
   */
  const loadUserTrades = useCallback(async (filters = {}) => {
    try {
      const response = await tradingService.getUserTrades(filters);
      
      // ✅ MANEJO SEGURO DE LA RESPUESTA
      let tradesData = [];
      
      if (response && response.success && Array.isArray(response.data)) {
        tradesData = response.data;
      } else if (Array.isArray(response)) {
        tradesData = response;
      }
      
      setUserTrades(tradesData);
      
    } catch (error) {
      console.error('Error loading user trades:', error);
      setUserTrades([]); // ✅ ARRAY VACÍO EN CASO DE ERROR
    }
  }, []);

  // ==================== ORDERS ====================

  /**
   * Crear una orden
   */
  const createOrder = useCallback(async (orderData) => {
    try {
      setLoading(prev => ({ ...prev, orders: true }));
      setErrors(prev => ({ ...prev, orders: null }));

      const response = await tradingService.createOrder({
        ...orderData,
        tradingPairId: activePair.id,
      });
      
      if (response && response.success) {
        // Recargar órdenes activas
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

  /**
   * Cancelar una orden
   */
  const cancelOrder = useCallback(async (orderId) => {
    try {
      const response = await tradingService.cancelOrder(orderId);
      
      if (response && response.success) {
        // Recargar órdenes activas
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

  /**
   * Cargar órdenes activas del usuario
   */

const loadActiveOrders = useCallback(async () => {
  try {
    console.log('📋 === CARGANDO ÓRDENES ACTIVAS ===');
    
    const response = await tradingService.getActiveOrders();
    
    console.log('📦 Response COMPLETA de Active Orders:', response);
    console.log('📦 Response JSON:', JSON.stringify(response, null, 2));
    
    let ordersData = [];
    
    if (response && response.success && Array.isArray(response.data)) {
      ordersData = response.data;
    } else if (Array.isArray(response)) {
      ordersData = response;
    } else if (response && Array.isArray(response.orders)) {
      ordersData = response.orders;
    }
    
    console.log('✅ Órdenes activas procesadas:', ordersData.length);
    if (ordersData.length > 0) {
      console.log('📋 Primera orden:', ordersData[0]);
    } else {
      console.log('⚠️ No hay órdenes activas');
    }
    
    setActiveOrders(ordersData);
    
  } catch (error) {
    console.error('❌ Error loading active orders:', error);
    console.error('❌ Error completo:', error.response?.data || error.message);
    setActiveOrders([]);
  }
}, []);

  /**
   * Cargar todas las órdenes del usuario
   */
  const loadUserOrders = useCallback(async (filters = {}) => {
    try {
      const response = await tradingService.getUserOrders(filters);
      
      // ✅ MANEJO SEGURO DE LA RESPUESTA
      let ordersData = [];
      
      if (response && response.success && Array.isArray(response.data)) {
        ordersData = response.data;
      } else if (Array.isArray(response)) {
        ordersData = response;
      }
      
      setUserOrders(ordersData);
      
    } catch (error) {
      console.error('Error loading user orders:', error);
      setUserOrders([]); // ✅ ARRAY VACÍO EN CASO DE ERROR
    }
  }, []);

  // ==================== BALANCE ====================

  /**
   * Cargar balance de trading
   */
const loadTradingBalance = useCallback(async () => {
  try {
    setLoading(prev => ({ ...prev, balance: true }));
    console.log('💰 Cargando balance de trading...');
    
    const response = await tradingService.getTradingBalance();
    console.log('📦 Response de balance:', response);
    
    let balanceData = [];
    
    if (response && response.success && Array.isArray(response.data)) {
      balanceData = response.data;
    } else if (Array.isArray(response)) {
      balanceData = response;
    } else if (response && Array.isArray(response.balances)) {
      balanceData = response.balances;
    }
    
    console.log('✅ Balance procesado:', balanceData.length, 'items');
    if (balanceData.length > 0) {
      console.log('💵 Primer balance:', balanceData[0]);
    }
    
    setTradingBalance(Array.isArray(balanceData) ? balanceData : []);
    
  } catch (error) {
    console.error('❌ Error loading trading balance:', error);
    setTradingBalance([]);
  } finally {
    setLoading(prev => ({ ...prev, balance: false }));
  }
}, []);

  // ==================== REAL-TIME UPDATES ====================

  /**
   * Iniciar actualizaciones en tiempo real
   */
  const startRealTimeUpdates = useCallback(() => {
    // Order book cada 2 segundos
    orderBookInterval.current = setInterval(() => {
      loadOrderBook();
    }, 2000);

    // Trades recientes cada 3 segundos
    tradesInterval.current = setInterval(() => {
      loadRecentTrades();
    }, 3000);

    // Tickers cada 5 segundos
    tickersInterval.current = setInterval(() => {
      loadTickers();
    }, 5000);
  }, [loadOrderBook, loadRecentTrades, loadTickers]);

  /**
   * Detener actualizaciones en tiempo real
   */
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

  // ✅ AGREGAR AL INICIO DEL HOOK (después de los states)
    useEffect(() => {
    console.log('=== 🐛 TRADING STATE DEBUG ===');
    console.log('📊 Trading Pairs:', tradingPairs);
    console.log('🎯 Active Pair:', activePair);
    console.log('💰 Trading Balance:', tradingBalance);
    console.log('📈 Chart Data length:', chartData.length);
    console.log('📖 Order Book:', orderBook);
    console.log('🔄 Loading states:', loading);
    console.log('❌ Errors:', errors);
    console.log('============================');
    }, [tradingPairs, activePair, tradingBalance, chartData, orderBook, loading, errors]);

  // Cargar pares al montar
  useEffect(() => {
    loadTradingPairs();
    loadTradingBalance();
  }, [loadTradingPairs, loadTradingBalance]);

  // Cargar datos cuando cambia el par activo
  useEffect(() => {
    if (activePair) {
      loadOrderBook();
      loadChartData();
      loadRecentTrades();
      loadActiveOrders();
    }
  }, [activePair, loadOrderBook, loadChartData, loadRecentTrades, loadActiveOrders]);

  // Limpiar intervalos al desmontar
  useEffect(() => {
    return () => {
      stopRealTimeUpdates();
    };
  }, [stopRealTimeUpdates]);

  // ==================== RETURN ====================

  return {
    // State
    tradingPairs,
    activePair,
    orderBook,
    chartData,
    recentTrades,
    userOrders,
    activeOrders,
    userTrades,
    tradingBalance,
    tickers,
    loading,
    errors,

    // Actions
    selectPair,
    loadTradingPairs,
    loadOrderBook,
    loadChartData,
    loadRecentTrades,
    loadUserTrades,
    createOrder,
    cancelOrder,
    loadActiveOrders,
    loadUserOrders,
    loadTradingBalance,
    loadTickers,
    startRealTimeUpdates,
    stopRealTimeUpdates,
  };
};

export default useTrading;