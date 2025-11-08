// mobile/components/home/TopAssetsList.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../constants/theme';
import Card from '../ui/Card';
import Button from '../ui/Button';

export default function TopAssetsList({ assets, onNavigate }) {
  const { theme } = useTheme();

  if (!assets || assets.length === 0) {
    return (
      <Card style={styles.card}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          Mis Activos Principales
        </Text>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            No tienes activos aún. ¡Empieza a operar!
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>
        Mis Activos Principales
      </Text>

      <View style={styles.assetsList}>
        {assets.slice(0, 3).map((asset, index) => (
          <View key={index} style={styles.assetItem}>
            <View style={styles.assetHeader}>
              <Text style={[styles.assetSymbol, { color: theme.textPrimary }]}>
                {asset.symbol}
              </Text>
              <Text style={[styles.assetPercentage, { color: theme.textSecondary }]}>
                {asset.percentage}%
              </Text>
            </View>

            <View style={[styles.assetBar, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.assetBarFill,
                  { backgroundColor: theme.brandPrimary, width: `${asset.percentage}%` }
                ]}
              />
            </View>

            <Text style={[styles.assetValue, { color: theme.textMuted }]}>
              ${(asset.value ?? 0).toFixed(2)}
            </Text>
          </View>
        ))}
      </View>

      <Button
        variant="outline"
        onPress={() => onNavigate('/activos')}
        style={styles.button}
      >
        Ver todos mis activos
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    marginBottom: spacing.md,
  },
  assetsList: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  assetItem: {
    gap: spacing.xs,
  },
  assetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assetSymbol: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  assetPercentage: {
    fontSize: fontSize.sm,
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
  button: {
    marginTop: spacing.sm,
  },
  emptyContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.base,
    textAlign: 'center',
  },
});