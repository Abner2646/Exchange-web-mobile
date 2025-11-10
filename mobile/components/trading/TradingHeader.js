// mobile/components/trading/TradingHeader.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize } from '../../constants/theme';

const TradingHeader = ({ pair, onPairPress }) => {
  const { theme } = useTheme();

  if (!pair) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.loadingText, { color: theme.textMuted }]}>
          Cargando...
        </Text>
      </View>
    );
  }

  const change24h = parseFloat(pair.priceChange24h || 0);
  const isPositive = change24h >= 0;

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
    <View style={[styles.container, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
      {/* Row 1: Par selector */}
      <TouchableOpacity 
        style={styles.pairSelector}
        onPress={onPairPress}
        activeOpacity={0.7}
      >
        <Text style={[styles.pairSymbol, { color: theme.textPrimary }]}>
          {pair.symbol}
        </Text>
        <Ionicons 
          name="chevron-down" 
          size={20} 
          color={theme.textPrimary} 
        />
      </TouchableOpacity>

      {/* Row 2: Price + Change */}
      <View style={styles.priceRow}>
        <Text style={[styles.price, { color: theme.textPrimary }]}>
          ${formatPrice(pair.lastPrice)}
        </Text>
        <View style={[styles.changeBadge, { backgroundColor: isPositive ? `${theme.buy}20` : `${theme.sell}20` }]}>
          <Ionicons 
            name={isPositive ? 'trending-up' : 'trending-down'} 
            size={14} 
            color={isPositive ? theme.buy : theme.sell} 
          />
          <Text style={[styles.changeText, { color: isPositive ? theme.buy : theme.sell }]}>
            {isPositive ? '+' : ''}{change24h.toFixed(2)}%
          </Text>
        </View>
      </View>

      {/* Row 3: Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            Volumen:
          </Text>
          <Text style={[styles.statValue, { color: theme.textPrimary }]}>
            {formatVolume(pair.volume24h)}
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            Alto:
          </Text>
          <Text style={[styles.statValue, { color: theme.buy }]}>
            ${formatPrice(pair.high24h || pair.lastPrice)}
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            Bajo:
          </Text>
          <Text style={[styles.statValue, { color: theme.sell }]}>
            ${formatPrice(pair.low24h || pair.lastPrice)}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
  },
  loadingText: {
    fontSize: fontSize.base,
  },
  pairSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  pairSymbol: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginRight: spacing.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  price: {
    fontSize: fontSize.xxxl,
    fontWeight: '700',
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  changeText: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: fontSize.sm,
  },
  statValue: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});

export default TradingHeader;