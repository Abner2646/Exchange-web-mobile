// mobile/app/(tabs)/trading.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../constants/theme';
import useTrading from '../../hooks/useTrading';

// Componentes
import TradingHeader from '../../components/trading/TradingHeader';
import SimpleTradingChart from '../../components/trading/SimpleTradingChart';
import OrderForm from '../../components/trading/OrderForm';
import CompactOrderBook from '../../components/trading/CompactOrderBook';
import TradesList from '../../components/trading/TradesList';
import OrdersList from '../../components/trading/OrdersList';
import MarketsList from '../../components/trading/MarketsList';

export default function Trading() {
  const { theme } = useTheme();
  const [selectedTab, setSelectedTab] = useState('chart');
  const [selectedInterval, setSelectedInterval] = useState('1h');

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
    setSelectedTab('chart');
  };

  // Manejar creación de orden
  const handleCreateOrder = async (orderData) => {
    const result = await createOrder(orderData);
    
    if (result.success) {
      Alert.alert(
        'Éxito',
        `Orden ${orderData.side === 'buy' ? 'de compra' : 'de venta'} creada exitosamente`
      );
    } else {
      Alert.alert(
        'Error',
        result.error || 'Error al crear la orden'
      );
    }
  };

  // Manejar cancelación de orden
  const handleCancelOrder = async (orderId) => {
    const result = await cancelOrder(orderId);
    
    if (result.success) {
      Alert.alert('Éxito', 'Orden cancelada exitosamente');
    } else {
      Alert.alert('Error', result.error || 'Error al cancelar la orden');
    }
  };

  const tabs = [
    { key: 'chart', label: 'Gráfico', icon: 'bar-chart' },
    { key: 'trading', label: 'Trading', icon: 'swap-horizontal' },
    { key: 'orders', label: 'Órdenes', icon: 'list' },
    { key: 'markets', label: 'Mercados', icon: 'apps' },
  ];

  const renderTabContent = () => {
    switch (selectedTab) {
      case 'chart':
        return (
          <ScrollView 
            style={styles.tabContent}
            showsVerticalScrollIndicator={false}
          >
            <SimpleTradingChart
              pair={activePair}
              data={chartData}
              selectedInterval={selectedInterval}
              onIntervalChange={handleIntervalChange}
              loading={loading.chart}
            />
            <TradesList
              trades={recentTrades}
              pair={activePair}
              loading={loading.trades}
            />
          </ScrollView>
        );

      case 'trading':
        return (
          <ScrollView 
            style={styles.tabContent}
            showsVerticalScrollIndicator={false}
          >
            <OrderForm
              pair={activePair}
              balance={tradingBalance}
              onSubmit={handleCreateOrder}
              loading={loading.orders}
            />
            <CompactOrderBook
              orderBook={orderBook}
              pair={activePair}
              loading={loading.orderBook}
            />
          </ScrollView>
        );

      case 'orders':
        return (
          <View style={styles.tabContent}>
            <OrdersList
              orders={activeOrders}
              onCancel={handleCancelOrder}
              loading={loading.orders}
            />
          </View>
        );

      case 'markets':
        return (
          <View style={styles.tabContent}>
            <MarketsList
              pairs={tradingPairs}
              activePair={activePair}
              onSelectPair={handleSelectPair}
              tickers={tickers}
            />
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <TradingHeader
        pair={activePair}
        onPairPress={() => setSelectedTab('markets')}
      />

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                selectedTab === tab.key && [
                  styles.tabActive,
                  { borderBottomColor: theme.brandPrimary }
                ],
              ]}
              onPress={() => setSelectedTab(tab.key)}
            >
              <Ionicons 
                name={tab.icon} 
                size={20} 
                color={selectedTab === tab.key ? theme.brandPrimary : theme.textSecondary} 
              />
              <Text 
                style={[
                  styles.tabLabel,
                  { color: selectedTab === tab.key ? theme.brandPrimary : theme.textSecondary }
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tab content */}
      {renderTabContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabsContainer: {
    borderBottomWidth: 1,
  },
  tabsContent: {
    paddingHorizontal: spacing.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabLabel: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
});