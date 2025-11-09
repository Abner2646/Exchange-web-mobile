// mobile/components/home/MarketList.js
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../constants/theme';
import Card from '../ui/Card';
import MarketItem from './MarketItem';

export default function MarketList({
  data = [],
  isLoading,
  error,
  currentPage,
  totalPages,
  onNextPage,
  onPreviousPage,
  onRetry,
}) {
  const { theme } = useTheme();
  const router = useRouter();

  const handleCryptoClick = (symbol) => {
    router.push(`/swap?from=${symbol}&to=USDT`);
  };

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

  if (isLoading && data.length === 0) {
    return (
      <Card elevated style={styles.card}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.brandPrimary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Cargando mercados...
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card elevated style={styles.card}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>
        Mercados Populares
      </Text>

      <FlatList
        data={data}
        renderItem={({ item }) => (
          <MarketItem coin={item} onPress={() => handleCryptoClick(item.symbol.toUpperCase())} />
        )}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: theme.border }]} />
        )}
      />

      {/* Paginación Compacta - Opción A */}
      <View style={styles.pagination}>
        <TouchableOpacity
          style={[
            styles.paginationButton,
            { 
              backgroundColor: currentPage === 1 
                ? theme.backgroundSecondary 
                : theme.brandPrimary,
              borderColor: theme.border
            }
          ]}
          onPress={onPreviousPage}
          disabled={currentPage === 1}
        >
          <Ionicons 
            name="chevron-back" 
            size={20} 
            color={currentPage === 1 ? theme.textMuted : '#ffffff'} 
          />
        </TouchableOpacity>

        <Text style={[styles.paginationInfo, { color: theme.textPrimary }]}>
          {currentPage}/{totalPages}
        </Text>

        <TouchableOpacity
          style={[
            styles.paginationButton,
            { 
              backgroundColor: currentPage === totalPages 
                ? theme.backgroundSecondary 
                : theme.brandPrimary,
              borderColor: theme.border
            }
          ]}
          onPress={onNextPage}
          disabled={currentPage === totalPages}
        >
          <Ionicons 
            name="chevron-forward" 
            size={20} 
            color={currentPage === totalPages ? theme.textMuted : '#ffffff'} 
          />
        </TouchableOpacity>
      </View>
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
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.sm,
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
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    gap: spacing.lg,
  },
  paginationButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  paginationInfo: {
    fontSize: fontSize.md,
    fontWeight: '700',
    minWidth: 50,
    textAlign: 'center',
  },
});
