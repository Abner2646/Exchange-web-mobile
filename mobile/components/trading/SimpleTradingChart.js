// mobile/components/trading/SimpleTradingChart.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../constants/theme';
import Card from '../ui/Card';

const SimpleTradingChart = ({ pair, data, selectedInterval, onIntervalChange, loading }) => {
  const { theme } = useTheme();

  const intervals = [
    { value: '1m', label: '1m' },
    { value: '5m', label: '5m' },
    { value: '15m', label: '15m' },
    { value: '30m', label: '30m' },
    { value: '1h', label: '1h' },
    { value: '4h', label: '4h' },
    { value: '1d', label: '1D' },
    { value: '1w', label: '1W' },
  ];

  const change24h = parseFloat(pair?.priceChange24h || 0);
  const isPositive = change24h >= 0;

  // Calcular estadísticas básicas
  const stats = {
    high24h: pair?.high24h || 0,
    low24h: pair?.low24h || 0,
    volume24h: pair?.volume24h || 0,
  };

  const formatPrice = (price) => {
    return parseFloat(price).toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    });
  };

  const formatVolume = (volume) => {
    const vol = parseFloat(volume);
    if (vol >= 1000000000) return `$${(vol / 1000000000).toFixed(2)}B`;
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(2)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(2)}K`;
    return `$${vol.toFixed(2)}`;
  };

  return (
    <Card style={styles.container}>
      {/* Interval selector */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.intervalsContainer}
        contentContainerStyle={styles.intervalsContent}
      >
        {intervals.map(interval => (
          <TouchableOpacity
            key={interval.value}
            style={[
              styles.intervalBtn,
              selectedInterval === interval.value && [
                styles.intervalBtnActive,
                { backgroundColor: theme.brandPrimary }
              ],
            ]}
            onPress={() => onIntervalChange(interval.value)}
          >
            <Text 
              style={[
                styles.intervalBtnText,
                { color: selectedInterval === interval.value ? '#ffffff' : theme.textSecondary }
              ]}
            >
              {interval.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Chart placeholder */}
      <View style={[styles.chartPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
        {loading ? (
          <View style={styles.placeholderContent}>
            <Ionicons 
              name="bar-chart-outline" 
              size={48} 
              color={theme.textMuted} 
            />
            <Text style={[styles.placeholderText, { color: theme.textMuted }]}>
              Cargando gráfico...
            </Text>
          </View>
        ) : (
          <View style={styles.placeholderContent}>
            <Ionicons 
              name="trending-up" 
              size={64} 
              color={isPositive ? theme.buy : theme.sell} 
            />
            <Text style={[styles.placeholderPrice, { color: theme.textPrimary }]}>
              ${formatPrice(pair?.lastPrice || 0)}
            </Text>
            <Text style={[styles.placeholderChange, { color: isPositive ? theme.buy : theme.sell }]}>
              {isPositive ? '+' : ''}{change24h.toFixed(2)}%
            </Text>
          </View>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            24h Alto
          </Text>
          <Text style={[styles.statValue, { color: theme.buy }]}>
            {formatPrice(stats.high24h)}
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            24h Bajo
          </Text>
          <Text style={[styles.statValue, { color: theme.sell }]}>
            {formatPrice(stats.low24h)}
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            Volumen 24h
          </Text>
          <Text style={[styles.statValue, { color: theme.textPrimary }]}>
            {formatVolume(stats.volume24h)}
          </Text>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  intervalsContainer: {
    marginBottom: spacing.md,
  },
  intervalsContent: {
    gap: spacing.xs,
  },
  intervalBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
  },
  intervalBtnActive: {
    borderRadius: borderRadius.sm,
  },
  intervalBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  chartPlaceholder: {
    height: 200,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  placeholderContent: {
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: fontSize.base,
    marginTop: spacing.sm,
  },
  placeholderPrice: {
    fontSize: fontSize.xxxl,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  placeholderChange: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
});

export default SimpleTradingChart;