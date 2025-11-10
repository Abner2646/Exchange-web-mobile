// mobile/components/home/MarketList.js
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useWatchlist } from '../../hooks/useWatchlist';
import { spacing, fontSize, borderRadius } from '../../constants/theme';
import Card from '../ui/Card';
import MarketItem from './MarketItem';
import { MarketItemSkeleton } from '../common/SkeletonLoader';

// ⭐ Habilitar LayoutAnimation en Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

export default function MarketList({
  allMarketData = [],
  isLoading,
  error,
  onRetry,
}) {
  const { theme } = useTheme();
  const router = useRouter();
  const { watchlist } = useWatchlist();
  const [displayCount, setDisplayCount] = useState(20);

  const handleCryptoClick = (symbol) => {
    router.push(`/swap?from=${symbol}&to=USDT`);
  };

  // Ordenar poniendo favoritos primero
  const sortedMarketData = useMemo(() => {
    return [...allMarketData].sort((a, b) => {
      const aIsFavorite = watchlist.includes(a.id);
      const bIsFavorite = watchlist.includes(b.id);
      
      if (aIsFavorite === bIsFavorite) return 0;
      if (aIsFavorite && !bIsFavorite) return -1;
      return 1;
    });
  }, [allMarketData, watchlist]);

  // ⭐ Animar cuando watchlist cambia
  useEffect(() => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        300, // duración en ms
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity
      )
    );
  }, [watchlist]);

  const handleLoadMore = useCallback(() => {
    if (displayCount < sortedMarketData.length) {
      setDisplayCount(prev => Math.min(prev + 20, sortedMarketData.length));
    }
  }, [displayCount, sortedMarketData.length]);

  const displayedData = sortedMarketData.slice(0, displayCount);
  const hasMore = displayCount < sortedMarketData.length;

  if (error) {
    return (
      <Card elevated style={styles.card}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.error} />
          <Text style={[styles.errorTitle, { color: theme.textPrimary }]}>
            Error al cargar mercados
          </Text>
          <Text style={[styles.errorMessage, { color: theme.textSecondary }]}>
            No pudimos obtener los datos del mercado
          </Text>
          {onRetry && (
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.brandPrimary }]}
              onPress={onRetry}
            >
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  }

  if (isLoading && displayedData.length === 0) {
    return (
      <Card elevated style={styles.card}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          Mercados Populares
        </Text>
        {[1, 2, 3, 4, 5].map((i) => (
          <MarketItemSkeleton key={i} />
        ))}
      </Card>
    );
  }

  return (
    <Card elevated style={styles.card}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>
        Mercados Populares
      </Text>

      <FlatList
        data={displayedData}
        renderItem={({ item }) => (
          <MarketItem coin={item} onPress={() => handleCryptoClick(item.symbol.toUpperCase())} />
        )}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: theme.border }]} />
        )}
        ListFooterComponent={() => {
          if (!hasMore) return null;
          
          return (
            <View style={styles.footerContainer}>
              <TouchableOpacity
                style={[styles.loadMoreButton, { backgroundColor: theme.brandPrimary }]}
                onPress={handleLoadMore}
              >
                <Text style={styles.loadMoreText}>Cargar más</Text>
                <Ionicons name="chevron-down" size={16} color="#ffffff" />
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    marginBottom: spacing.md,
  },
  errorContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
  },
  errorMessage: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    marginVertical: spacing.xs,
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
  },
  loadMoreText: {
    color: '#ffffff',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});