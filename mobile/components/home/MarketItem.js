// mobile/components/home/MarketItem.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../constants/theme';

export default function MarketItem({ coin, onPress }) {
  const { theme } = useTheme();

  const isPositive = coin.price_change_percentage_24h >= 0;

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: theme.backgroundElevated }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Icono + Nombre */}
      <View style={styles.coinInfo}>
        <Image source={{ uri: coin.image }} style={styles.coinIcon} />
        <View>
          <Text style={[styles.coinSymbol, { color: theme.textPrimary }]}>
            {coin.symbol.toUpperCase()}
          </Text>
          <Text style={[styles.coinName, { color: theme.textSecondary }]} numberOfLines={1}>
            {coin.name}
          </Text>
        </View>
      </View>

      {/* Precio + Cambio */}
      <View style={styles.priceInfo}>
        <Text style={[styles.price, { color: theme.textPrimary }]}>
          ${coin.current_price.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>
        <Text
          style={[
            styles.change,
            { color: isPositive ? theme.buy : theme.sell }
          ]}
        >
          {isPositive ? '+' : ''}
          {coin.price_change_percentage_24h.toFixed(2)}%
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  coinInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  coinIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
  },
  coinSymbol: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  coinName: {
    fontSize: fontSize.xs,
  },
  priceInfo: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  change: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
