// mobile/components/home/MarketItem.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useWatchlist } from '../../hooks/useWatchlist';
import { spacing, fontSize, borderRadius } from '../../constants/theme';

export default function MarketItem({ coin, onPress }) {
  const { theme } = useTheme();
  const { isInWatchlist, toggleWatchlist } = useWatchlist();

  // ✅ Validación segura de valores
  const priceChange = coin.price_change_percentage_24h ?? 0;
  const currentPrice = coin.current_price ?? 0;
  const isPositive = priceChange >= 0;
  const isFavorite = isInWatchlist(coin.id);

  const handleToggleFavorite = (e) => {
    e.stopPropagation();
    toggleWatchlist(coin.id);
  };

  // ✅ Función helper para formatear el cambio
  const formatChange = (change) => {
    if (change === null || change === undefined) return '0.00';
    return Math.abs(change).toFixed(2);
  };

  // ✅ Función helper para formatear precio
  const formatPrice = (price) => {
    if (!price && price !== 0) return '0.00';
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: theme.backgroundElevated }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Estrella de Favorito */}
      <TouchableOpacity
        style={styles.favoriteButton}
        onPress={handleToggleFavorite}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons
          name={isFavorite ? 'star' : 'star-outline'}
          size={20}
          color={isFavorite ? '#FFD700' : theme.textMuted}
        />
      </TouchableOpacity>

      {/* Icono + Nombre */}
      <View style={styles.coinInfo}>
        <Image 
          source={{ uri: coin.image }} 
          style={styles.coinIcon}
          defaultSource={require('../../assets/images/placeholder-coin.png')}
        />
        <View>
          <Text style={[styles.coinSymbol, { color: theme.textPrimary }]}>
            {coin.symbol?.toUpperCase() || 'N/A'}
          </Text>
          <Text style={[styles.coinName, { color: theme.textSecondary }]} numberOfLines={1}>
            {coin.name || 'Unknown'}
          </Text>
        </View>
      </View>

      {/* Precio + Cambio */}
      <View style={styles.priceInfo}>
        <Text style={[styles.price, { color: theme.textPrimary }]}>
          ${formatPrice(currentPrice)}
        </Text>
        <Text
          style={[
            styles.change,
            { color: isPositive ? theme.buy : theme.sell }
          ]}
        >
          {isPositive ? '+' : '-'}
          {formatChange(priceChange)}%
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  favoriteButton: {
    padding: spacing.xs,
    marginRight: spacing.xs,
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