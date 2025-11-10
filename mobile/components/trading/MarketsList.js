// mobile/components/trading/MarketsList.js
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../constants/theme';
import Card from '../ui/Card';

const MarketsList = ({ pairs, activePair, onSelectPair, tickers }) => {
  const { theme } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [quoteFilter, setQuoteFilter] = useState('ALL');

  // Obtener quote assets únicos
  const quoteAssets = useMemo(() => {
    const quotes = new Set();
    pairs.forEach(pair => {
      if (pair.quoteAsset?.symbol) {
        quotes.add(pair.quoteAsset.symbol);
      }
    });
    return ['ALL', ...Array.from(quotes)];
  }, [pairs]);

  // Filtrar pares
  const filteredPairs = useMemo(() => {
    return pairs.filter(pair => {
      // Filtro de búsqueda
      const searchMatch = 
        pair.symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pair.baseAsset?.symbol?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filtro por quote asset
      const quoteMatch = quoteFilter === 'ALL' || 
                        pair.quoteAsset?.symbol === quoteFilter;
      
      return searchMatch && quoteMatch && pair.lastPrice && parseFloat(pair.lastPrice) > 0;
    });
  }, [pairs, searchTerm, quoteFilter]);

  const formatPrice = (price, precision = 2) => {
    if (!price) return '0.00';
    const numPrice = parseFloat(price);
    return numPrice.toLocaleString('es-AR', {
      minimumFractionDigits: Math.min(precision, 2),
      maximumFractionDigits: precision
    });
  };

  const formatVolume = (volume) => {
    if (!volume) return '0';
    const vol = parseFloat(volume);
    if (vol >= 1000000000) return `${(vol / 1000000000).toFixed(2)}B`;
    if (vol >= 1000000) return `${(vol / 1000000).toFixed(2)}M`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(2)}K`;
    return vol.toFixed(2);
  };

  const renderPair = ({ item: pair }) => {
    const isActive = activePair?.id === pair.id;
    const change24h = parseFloat(pair.priceChange24h || 0);
    const isPositive = change24h >= 0;

    return (
      <TouchableOpacity
        style={[
          styles.pairCard,
          { backgroundColor: isActive ? `${theme.brandPrimary}20` : theme.backgroundElevated },
        ]}
        onPress={() => onSelectPair(pair)}
        activeOpacity={0.7}
      >
        {/* Left - Icons + Symbol */}
        <View style={styles.pairLeft}>
          <View style={styles.iconsContainer}>
            <MaterialCommunityIcons 
              name="bitcoin" 
              size={24} 
              color={theme.brandPrimary} 
            />
          </View>
          <View style={styles.pairInfo}>
            <Text style={[styles.pairSymbol, { color: theme.textPrimary }]}>
              {pair.baseAsset?.symbol}
              <Text style={[styles.pairQuote, { color: theme.textMuted }]}>
                /{pair.quoteAsset?.symbol}
              </Text>
            </Text>
            <Text style={[styles.pairVolume, { color: theme.textMuted }]}>
              Vol {formatVolume(pair.volume24h)}
            </Text>
          </View>
        </View>

        {/* Right - Price + Change */}
        <View style={styles.pairRight}>
          <Text style={[styles.pairPrice, { color: theme.textPrimary }]}>
            {formatPrice(pair.lastPrice, pair.pricePrecision)}
          </Text>
          <View style={styles.changeContainer}>
            <Ionicons 
              name={isPositive ? 'trending-up' : 'trending-down'} 
              size={14} 
              color={isPositive ? theme.buy : theme.sell} 
            />
            <Text style={[styles.pairChange, { color: isPositive ? theme.buy : theme.sell }]}>
              {isPositive ? '+' : ''}{change24h.toFixed(2)}%
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: theme.backgroundElevated }]}>
        <Ionicons 
          name="search" 
          size={20} 
          color={theme.textMuted} 
        />
        <TextInput
          style={[styles.searchInput, { color: theme.textPrimary }]}
          placeholder="Buscar par..."
          placeholderTextColor={theme.textMuted}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        {searchTerm !== '' && (
          <TouchableOpacity onPress={() => setSearchTerm('')}>
            <Ionicons 
              name="close-circle" 
              size={20} 
              color={theme.textMuted} 
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Quote filters */}
      <View style={styles.filtersRow}>
        {quoteAssets.map(quote => (
          <TouchableOpacity
            key={quote}
            style={[
              styles.filterBtn,
              quoteFilter === quote && [
                styles.filterBtnActive,
                { backgroundColor: theme.brandPrimary }
              ],
            ]}
            onPress={() => setQuoteFilter(quote)}
          >
            <Text 
              style={[
                styles.filterBtnText,
                { color: quoteFilter === quote ? '#ffffff' : theme.textSecondary }
              ]}
            >
              {quote}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Pairs list */}
      {filteredPairs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons 
            name="search-outline" 
            size={48} 
            color={theme.textMuted} 
          />
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            No se encontraron pares
          </Text>
          {searchTerm && (
            <Text style={[styles.emptyHint, { color: theme.textMuted }]}>
              Intenta con otros términos
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredPairs}
          renderItem={renderPair}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.base,
    padding: 0,
  },
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  filterBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
  },
  filterBtnActive: {
    borderRadius: borderRadius.sm,
  },
  filterBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  pairCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  pairLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconsContainer: {
    marginRight: spacing.sm,
  },
  pairInfo: {
    flex: 1,
  },
  pairSymbol: {
    fontSize: fontSize.base,
    fontWeight: '700',
  },
  pairQuote: {
    fontSize: fontSize.base,
    fontWeight: '400',
  },
  pairVolume: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  pairRight: {
    alignItems: 'flex-end',
  },
  pairPrice: {
    fontSize: fontSize.base,
    fontWeight: '600',
    marginBottom: 2,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pairChange: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.base,
    marginTop: spacing.md,
  },
  emptyHint: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
});

export default MarketsList;