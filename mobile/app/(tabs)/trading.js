// mobile/app/(tabs)/trading.js
// ✅ VERSIÓN SIMPLIFICADA CON DEBUG

import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize } from '../../constants/theme';
import useTrading from '../../hooks/useTrading';

// Componentes
import TradingHeader from '../../components/trading/TradingHeader';
import TradingChart from '../../components/trading/TradingChart';
import OrderForm from '../../components/trading/OrderForm';
import CompactOrderBook from '../../components/trading/CompactOrderBook';
import TradesList from '../../components/trading/TradesList';
import OrdersList from '../../components/trading/OrdersList';
import MarketsList from '../../components/trading/MarketsList';

export default function TradingScreen() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('chart');
  const [selectedInterval, setSelectedInterval] = useState('1h');

  const {
    tradingPairs,
    activePair,
    orderBook,
    chartData,
    recentTrades,
    activeOrders,
    tradingBalance,
    loading,
    selectPair,
    loadChartData,
    createOrder,
    cancelOrder,
  } = useTrading('BTC/USDT');

  const handleIntervalChange = (interval) => {
    console.log('⏱️ Cambiando intervalo a:', interval);
    setSelectedInterval(interval);
    if (activePair) {
      loadChartData(interval);
    }
  };

  const handlePairSelect = (pair) => {
    console.log('🎯 Seleccionando par:', pair.symbol);
    selectPair(pair);
    setActiveTab('chart');
  };

  // Debug logs
  console.log('📱 === TRADING SCREEN RENDER ===');
  console.log('  activeTab:', activeTab);
  console.log('  activePair:', activePair?.symbol || 'null');
  console.log('  chartData:', chartData?.length || 0, 'items');
  console.log('  loading.chart:', loading.chart);

  if (!activePair) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centered}>
          <Text style={[styles.text, { color: theme.textPrimary }]}>
            Cargando pares de trading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header con precio */}
      <TradingHeader
        pair={activePair}
        onPairPress={() => setActiveTab('markets')}
      />

      {/* Tabs de navegación */}
      <View style={[styles.tabsContainer, { backgroundColor: theme.backgroundSecondary }]}>
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => {
            console.log('📊 Cambiando a tab: chart');
            setActiveTab('chart');
          }}
        >
          <Text 
            style={[
              styles.tabText, 
              { 
                color: activeTab === 'chart' ? theme.brandPrimary : theme.textSecondary,
                fontWeight: activeTab === 'chart' ? '700' : '400'
              }
            ]}
          >
            Gráfico
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setActiveTab('trading')}
        >
          <Text 
            style={[
              styles.tabText, 
              { 
                color: activeTab === 'trading' ? theme.brandPrimary : theme.textSecondary,
                fontWeight: activeTab === 'trading' ? '700' : '400'
              }
            ]}
          >
            Trading
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setActiveTab('orders')}
        >
          <Text 
            style={[
              styles.tabText, 
              { 
                color: activeTab === 'orders' ? theme.brandPrimary : theme.textSecondary,
                fontWeight: activeTab === 'orders' ? '700' : '400'
              }
            ]}
          >
            Órdenes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setActiveTab('markets')}
        >
          <Text 
            style={[
              styles.tabText, 
              { 
                color: activeTab === 'markets' ? theme.brandPrimary : theme.textSecondary,
                fontWeight: activeTab === 'markets' ? '700' : '400'
              }
            ]}
          >
            Mercados
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contenido según tab activo */}
      <View style={styles.contentContainer}>
        {activeTab === 'chart' && (
          <ScrollView 
            style={styles.scrollContent} 
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            <Text style={[styles.debugText, { color: theme.textMuted }]}>
              📊 Tab CHART activo - Datos: {chartData?.length || 0}
            </Text>
            
            <TradingChart
              data={chartData}
              pair={activePair}
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
        )}

        {activeTab === 'trading' && (
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <OrderForm
              pair={activePair}
              balance={tradingBalance}
              onSubmit={createOrder}
              loading={loading.orders}
            />
            <CompactOrderBook
              orderBook={orderBook}
              pair={activePair}
              loading={loading.orderBook}
            />
          </ScrollView>
        )}

        {activeTab === 'orders' && (
          <OrdersList
            orders={activeOrders}
            onCancelOrder={cancelOrder}
            loading={loading.orders}
          />
        )}

        {activeTab === 'markets' && (
          <MarketsList
            pairs={tradingPairs}
            onSelectPair={handlePairSelect}
            loading={loading.pairs}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: fontSize.base,
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
  },
  tabText: {
    fontSize: fontSize.sm,
  },
  contentContainer: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  debugText: {
    fontSize: fontSize.xs,
    padding: spacing.sm,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});