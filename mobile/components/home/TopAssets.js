// mobile/components/home/TopAssets.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../constants/theme';
import Card from '../ui/Card';
import { TopAssetsSkeleton } from '../common/SkeletonLoader';

export default function TopAssets({ assets, isLoading }) {
  const { theme } = useTheme();
  const router = useRouter();

  if (isLoading) {
    return <TopAssetsSkeleton />;
  }

  if (!assets || assets.length === 0) {
    return (
      <Card elevated style={styles.card}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          Mis Activos Principales
        </Text>
        <View style={styles.emptyContainer}>
          <Ionicons name="wallet-outline" size={64} color={theme.textMuted} />
          <Text style={[styles.emptyText, { color: theme.textPrimary }]}>
            No tienes activos aún
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.textMuted }]}>
            ¡Empieza a operar para ver tus activos aquí!
          </Text>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: theme.brandPrimary }]}
            onPress={() => router.push('/deposits')}
          >
            <Ionicons name="wallet-outline" size={20} color="#ffffff" />
            <Text style={styles.emptyButtonText}>Depositar Ahora</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  }

  return (
    <Card elevated style={styles.card}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>
        Mis Activos Principales
      </Text>
      
      <View style={styles.assetsList}>
        {assets.map((asset, index) => {
          const isPositive = (asset.priceChange24h || 0) >= 0;

          return (
            <View key={index} style={styles.assetItem}>
              <View style={styles.assetHeader}>
                <View style={styles.assetInfo}>
                  <Text style={[styles.assetSymbol, { color: theme.textPrimary }]}>
                    {asset.symbol}
                  </Text>
                  <Text style={[styles.assetPercentage, { color: theme.brandPrimary }]}>
                    {asset.percentage}%
                  </Text>
                </View>
                
                {/* Cambio 24h */}
                <View style={styles.assetChange}>
                  <Text
                    style={[
                      styles.assetChangeText,
                      { color: isPositive ? theme.buy : theme.sell }
                    ]}
                  >
                    {isPositive ? '+' : ''}
                    {(asset.priceChange24h || 0).toFixed(2)}%
                  </Text>
                  <Ionicons
                    name={isPositive ? 'trending-up' : 'trending-down'}
                    size={14}
                    color={isPositive ? theme.buy : theme.sell}
                  />
                </View>
              </View>
              
              <View style={[styles.assetBar, { backgroundColor: theme.backgroundSecondary }]}>
                <View
                  style={[
                    styles.assetBarFill,
                    { 
                      width: `${asset.percentage}%`,
                      backgroundColor: theme.brandPrimary
                    }
                  ]}
                />
              </View>
              
              {/* ⭐ SIN EMOJI - Solo valor */}
              <Text style={[styles.assetValue, { color: theme.textSecondary }]}>
                ${(asset.value ?? 0).toFixed(2)}
              </Text>
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        style={[
          styles.viewAllButton,
          { 
            backgroundColor: theme.backgroundSecondary,
            borderColor: theme.border
          }
        ]}
        onPress={() => router.push('/assets')}
      >
        <Text style={[styles.viewAllText, { color: theme.brandPrimary }]}>
          Ver todos mis activos
        </Text>
        <Ionicons name="arrow-forward" size={16} color={theme.brandPrimary} />
      </TouchableOpacity>
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  assetsList: {
    gap: spacing.lg,
  },
  assetItem: {
    gap: spacing.xs,
  },
  assetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  assetSymbol: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  assetPercentage: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  assetChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  assetChangeText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  assetBar: {
    height: 8,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  assetBarFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  assetValue: {
    fontSize: fontSize.sm,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  viewAllText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});