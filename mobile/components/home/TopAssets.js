// mobile/components/home/TopAssets.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../constants/theme';
import Card from '../ui/Card';

export default function TopAssets({ assets, isLoading }) {
  const { theme } = useTheme();
  const router = useRouter();

  if (isLoading) {
    return (
      <Card elevated style={styles.card}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.brandPrimary} />
        </View>
      </Card>
    );
  }

  if (!assets || assets.length === 0) {
    return (
      <Card elevated style={styles.card}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          Mis Activos Principales
        </Text>
        <View style={styles.emptyContainer}>
          <Ionicons name="wallet-outline" size={48} color={theme.textMuted} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No tienes activos aún
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.textMuted }]}>
            ¡Empieza a operar!
          </Text>
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
        {assets.map((asset, index) => (
          <View key={index} style={styles.assetItem}>
            <View style={styles.assetInfo}>
              <Text style={[styles.assetSymbol, { color: theme.textPrimary }]}>
                {asset.symbol}
              </Text>
              <Text style={[styles.assetPercentage, { color: theme.brandPrimary }]}>
                {asset.percentage}%
              </Text>
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
            
            <Text style={[styles.assetValue, { color: theme.textSecondary }]}>
              ${(asset.value ?? 0).toFixed(2)}
            </Text>
          </View>
        ))}
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
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    marginBottom: spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  assetsList: {
    gap: spacing.md,
  },
  assetItem: {
    gap: spacing.xs,
  },
  assetInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assetSymbol: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  assetPercentage: {
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