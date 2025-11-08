// mobile/components/home/BalanceHero.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../constants/theme';
import Card from '../ui/Card';

export default function BalanceHero({ totalUSDT, totalBTC, btcPriceError, onNavigate }) {
  const { theme } = useTheme();

  return (
    <Card elevated style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          Portfolio Total
        </Text>
      </View>

      <View style={styles.balanceContainer}>
        <Text style={[styles.currency, { color: theme.textPrimary }]}>$</Text>
        <Text style={[styles.amount, { color: theme.textPrimary }]}>
          {totalUSDT.toFixed(2)}
        </Text>
        <Text style={[styles.currency, { color: theme.textPrimary }]}>USD</Text>
      </View>

      {!btcPriceError ? (
        <Text style={[styles.btcAmount, { color: theme.textMuted }]}>
          ≈ {totalBTC.toFixed(8)} BTC
        </Text>
      ) : (
        <Text style={[styles.btcAmount, styles.btcError, { color: theme.danger }]}>
          Precio BTC no disponible
        </Text>
      )}

      <View style={styles.actionsGrid}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}
          onPress={() => onNavigate('/depositos')}
        >
          <Text style={[styles.actionText, { color: theme.textPrimary }]}>Depositar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}
          onPress={() => onNavigate('/retiros')}
        >
          <Text style={[styles.actionText, { color: theme.textPrimary }]}>Retirar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton, { backgroundColor: theme.brandPrimary }]} // ⭐ CAMBIO
          onPress={() => onNavigate('/swap')}
        >
          <Text style={[styles.actionText, styles.primaryText]}>Swap</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton, { backgroundColor: theme.brandPrimary }]} // ⭐ CAMBIO
          onPress={() => onNavigate('/p2p')}
        >
          <Text style={[styles.actionText, styles.primaryText]}>P2P</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
  },
  header: {
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  currency: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    marginHorizontal: spacing.xs,
  },
  amount: {
    fontSize: fontSize.xxxl,
    fontWeight: 'bold',
  },
  btcAmount: {
    fontSize: fontSize.sm,
    marginBottom: spacing.lg,
  },
  btcError: {
    fontStyle: 'italic',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  primaryButton: {
    borderWidth: 0,
  },
  actionText: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  primaryText: {
    color: '#ffffff',
  },
});