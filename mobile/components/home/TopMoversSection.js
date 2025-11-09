// mobile/components/home/TopMoversSection.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../constants/theme';
import Card from '../ui/Card';

export default function TopMoversSection({
  gainers24h = [],
  losers24h = [],
  gainers7d = [],
  losers7d = [],
  isLoading,
  error,
  onRetry,
}) {
  const { theme } = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('24h');

  const gainers = activeTab === '24h' ? gainers24h : gainers7d;
  const losers = activeTab === '24h' ? losers24h : losers7d;

  const hasEnoughData = gainers.length >= 3 && losers.length >= 3;

  const handleCryptoClick = (symbol) => {
    router.push(`/swap?from=${symbol}&to=USDT`);
  };

  if (error) {
    return (
      <Card elevated style={styles.card}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.error} />
          <Text style={[styles.errorTitle, { color: theme.textPrimary }]}>
            Error al cargar movimientos
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

  if (isLoading) {
    return (
      <Card elevated style={styles.card}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          Mayores Movimientos
        </Text>
        <View style={styles.tabs}>
          <View style={[styles.tabSkeleton, { backgroundColor: theme.backgroundSecondary }]} />
          <View style={[styles.tabSkeleton, { backgroundColor: theme.backgroundSecondary }]} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.brandPrimary} />
        </View>
      </Card>
    );
  }

  if (!hasEnoughData) {
    return null;
  }

  return (
    <Card elevated style={styles.card}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>
        Mayores Movimientos
      </Text>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === '24h' && styles.tabActive,
            {
              backgroundColor: activeTab === '24h' 
                ? theme.brandPrimary 
                : theme.backgroundSecondary,
              borderColor: theme.border,
            }
          ]}
          onPress={() => setActiveTab('24h')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === '24h' ? '#ffffff' : theme.textSecondary }
            ]}
          >
            24 Horas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === '7d' && styles.tabActive,
            {
              backgroundColor: activeTab === '7d' 
                ? theme.brandPrimary 
                : theme.backgroundSecondary,
              borderColor: theme.border,
            }
          ]}
          onPress={() => setActiveTab('7d')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === '7d' ? '#ffffff' : theme.textSecondary }
            ]}
          >
            7 Días
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contenido */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.moversContainer}>
          {/* Ganadores */}
          <View style={styles.moverColumn}>
            <View style={[styles.moverHeader, { backgroundColor: theme.buyBg }]}>
              <Ionicons name="trending-up" size={20} color={theme.buy} />
              <Text style={[styles.moverHeaderText, { color: theme.buy }]}>
                Top Ganadores
              </Text>
            </View>
            <View style={styles.moverList}>
              {gainers.map((coin) => (
                <TouchableOpacity
                  key={coin.id}
                  style={[styles.moverItem, { borderBottomColor: theme.border }]}
                  onPress={() => handleCryptoClick(coin.symbol.toUpperCase())}
                >
                  <Image source={{ uri: coin.image }} style={styles.coinIcon} />
                  <View style={styles.moverInfo}>
                    <Text style={[styles.coinSymbol, { color: theme.textPrimary }]}>
                      {coin.symbol.toUpperCase()}
                    </Text>
                    <Text style={[styles.coinPrice, { color: theme.textSecondary }]}>
                      ${coin.current_price.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={[styles.moverChange, { color: theme.buy }]}>
                    +{coin.changePercentage.toFixed(2)}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Perdedores */}
          <View style={styles.moverColumn}>
            <View style={[styles.moverHeader, { backgroundColor: theme.sellBg }]}>
              <Ionicons name="trending-down" size={20} color={theme.sell} />
              <Text style={[styles.moverHeaderText, { color: theme.sell }]}>
                Top Perdedores
              </Text>
            </View>
            <View style={styles.moverList}>
              {losers.map((coin) => (
                <TouchableOpacity
                  key={coin.id}
                  style={[styles.moverItem, { borderBottomColor: theme.border }]}
                  onPress={() => handleCryptoClick(coin.symbol.toUpperCase())}
                >
                  <Image source={{ uri: coin.image }} style={styles.coinIcon} />
                  <View style={styles.moverInfo}>
                    <Text style={[styles.coinSymbol, { color: theme.textPrimary }]}>
                      {coin.symbol.toUpperCase()}
                    </Text>
                    <Text style={[styles.coinPrice, { color: theme.textSecondary }]}>
                      ${coin.current_price.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={[styles.moverChange, { color: theme.sell }]}>
                    {coin.changePercentage.toFixed(2)}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
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
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  tabActive: {
    borderWidth: 0,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  tabSkeleton: {
    flex: 1,
    height: 36,
    borderRadius: borderRadius.md,
  },
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
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
  moversContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  moverColumn: {
    width: 280,
  },
  moverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  moverHeaderText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  moverList: {
    gap: spacing.xs,
  },
  moverItem: {
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
  moverInfo: {
    flex: 1,
  },
  coinSymbol: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  coinPrice: {
    fontSize: fontSize.xs,
  },
  moverChange: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});