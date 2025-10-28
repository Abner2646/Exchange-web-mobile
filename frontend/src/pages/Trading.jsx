// src/pages/Trading.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useTrading from '../hooks/useTrading';
import TradingChart from '../components/features/TradingChart';
import OrderBook from '../components/features/OrderBook';
import OrderForm from '../components/features/OrderForm';
import TradingPairSelector from '../components/features/TradingPairSelector';
import UserOrders from '../components/features/UserOrders';
import TradeHistory from '../components/features/TradeHistory';
import Toast from '../components/common/Toast';
import '../styles/Trading.css';

const Trading = () => {
  const navigate = useNavigate();
  const [selectedInterval, setSelectedInterval] = useState('1h');
  const [toast, setToast] = useState(null);

  const {
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
    loadChartData,
    createOrder,
    cancelOrder,
    loadActiveOrders,
    startRealTimeUpdates,
    stopRealTimeUpdates,
  } = useTrading('BTC/USDT');

  // Iniciar actualizaciones en tiempo real
  useEffect(() => {
    startRealTimeUpdates();
    return () => stopRealTimeUpdates();
  }, [startRealTimeUpdates, stopRealTimeUpdates]);

  // Manejar cambio de intervalo del gráfico
  const handleIntervalChange = (interval) => {
    setSelectedInterval(interval);
    loadChartData(interval);
  };

  // Manejar selección de par
  const handleSelectPair = (pair) => {
    selectPair(pair);
  };

  // Manejar creación de orden
  const handleCreateOrder = async (orderData) => {
    const result = await createOrder(orderData);
    
    if (result.success) {
      setToast({
        type: 'success',
        message: `Orden ${orderData.side === 'buy' ? 'de compra' : 'de venta'} creada exitosamente`,
      });
    } else {
      setToast({
        type: 'error',
        message: result.error || 'Error al crear la orden',
      });
    }
  };

  // Manejar cancelación de orden
  const handleCancelOrder = async (orderId) => {
    const result = await cancelOrder(orderId);
    
    if (result.success) {
      setToast({
        type: 'success',
        message: 'Orden cancelada exitosamente',
      });
    } else {
      setToast({
        type: 'error',
        message: result.error || 'Error al cancelar la orden',
      });
    }
  };

  return (
    <div className="trading-container">
      {/* Header */}
      <div className="trading-header">
        <h1 className="trading-title">Trading Spot</h1>
        <p className="trading-description">
          Opera con las principales criptomonedas en tiempo real
        </p>
      </div>

      {/* Main layout */}
      <div className="trading-layout">
        {/* Left sidebar - Trading Pairs */}
        <aside className="trading-sidebar trading-sidebar-left">
          <TradingPairSelector
            pairs={tradingPairs}
            activePair={activePair}
            onSelectPair={handleSelectPair}
            tickers={tickers}
          />
        </aside>

        {/* Center - Chart */}
        <main className="trading-main">
          <div className="trading-chart-section">
            <TradingChart
              data={chartData}
              pair={activePair}
              loading={loading.chart}
              onIntervalChange={handleIntervalChange}
            />
          </div>

          {/* Orders section */}
          <div className="trading-orders-section">
            <UserOrders
              orders={activeOrders}
              onCancel={handleCancelOrder}
              loading={loading.orders}
            />
          </div>
        </main>

        {/* Right sidebar - Order Book, Form, Trades */}
        <aside className="trading-sidebar trading-sidebar-right">
          {/* Order Form */}
          <div className="trading-sidebar-section">
            <OrderForm
              pair={activePair}
              balance={tradingBalance}
              onSubmit={handleCreateOrder}
              loading={loading.orders}
            />
          </div>

          {/* Order Book */}
          <div className="trading-sidebar-section">
            <OrderBook
              orderBook={orderBook}
              pair={activePair}
              loading={loading.orderBook}
            />
          </div>

          {/* Trade History */}
          <div className="trading-sidebar-section">
            <TradeHistory
              trades={recentTrades}
              pair={activePair}
              loading={loading.trades}
            />
          </div>
        </aside>
      </div>

      {/* Toast notifications */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default Trading;