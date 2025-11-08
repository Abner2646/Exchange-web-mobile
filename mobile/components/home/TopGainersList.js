// mobile/components/home/TopGainersList.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../constants/theme';
import Card from '../ui/Card';
import Button from '../ui/Button';

export default function TopGainersList({ gainers, onCryptoClick, onViewMarket }) {
  const { theme } = useTheme();

  if (!gainers || gainers.length === 0) {
    return null;
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.icon, { color: theme.success }]}>🔥</Text>
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          Top Ganadores (24h)
        </Text>
      </View>

      <View style={styles.gainersList}>
        {gainers.slice(0, 5).map((coin) => (
          <TouchableOpacity
            key={coin.id}
            style={[styles.gainerItem, { borderBottomColor: theme.border }]}
            onPress={() => onCryptoClick?.(coin.symbol.toUpperCase())}
          >
            <Image
              source={{ uri: coin.image }}
              style={styles.coinIcon}
            />

            <View style={styles.coinInfo}>
              <Text style={[styles.coinSymbol, { color: theme.textPrimary }]}>
                {coin.symbol.toUpperCase()}
              </Text>
              <Text style={[styles.coinPrice, { color: theme.textSecondary }]}>
                ${coin.current_price.toFixed(2)}
              </Text>
            </View>

            <Text style={[styles.coinChange, { color: theme.success }]}>
              +{coin.changePercentage.toFixed(2)}%
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Button
        variant="outline"
        onPress={onViewMarket}
        style={styles.button}
      >
        Ver mercado completo
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  icon: {
    fontSize: fontSize.xl,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
  },
  gainersList: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  gainerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  coinIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
  },
  coinInfo: {
    flex: 1,
  },
  coinSymbol: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  coinPrice: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  coinChange: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  button: {
    marginTop: spacing.sm,
  },
});