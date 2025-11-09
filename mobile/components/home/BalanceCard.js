// mobile/components/home/BalanceCard.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../constants/theme';
import Card from '../ui/Card';

export default function BalanceCard({ totalUSDT, totalBTC, btcPriceError, isLoading }) {
  const { theme } = useTheme();
  const router = useRouter();

  if (isLoading) {
    return (
      <Card elevated style={styles.card}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.brandPrimary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Cargando portfolio...
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card elevated style={styles.card}>
      {/* Portfolio Total */}
      <View style={styles.balanceHeader}>
        <Text style={[styles.balanceLabel, { color: theme.textSecondary }]}>
          Portfolio Total
        </Text>
        <View style={styles.balanceAmountContainer}>
          <Text style={[styles.balanceCurrency, { color: theme.textMuted }]}>$</Text>
          <Text style={[styles.balanceAmount, { color: theme.textPrimary }]}>
            {totalUSDT.toFixed(2)}
          </Text>
          <Text style={[styles.balanceCurrency, { color: theme.textMuted }]}>USD</Text>
        </View>
        {!btcPriceError ? (
          <Text style={[styles.balanceBTC, { color: theme.textMuted }]}>
            ≈ {totalBTC.toFixed(8)} BTC
          </Text>
        ) : (
          <Text style={[styles.balanceBTC, { color: theme.error }]}>
            Precio BTC no disponible
          </Text>
        )}
      </View>

      {/* Grid de Acciones 2x2 - ORDEN NUEVO */}
      <View style={styles.actionsGrid}>
        {/* Fila 1: Depositar (azul) + Swap (azul) */}
        <View style={styles.actionsRow}>
          {/* 1) Depositar - PRIMARY (azul) */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.actionButtonPrimary,
              styles.actionButtonLeft,
              { backgroundColor: theme.brandPrimary }
            ]}
            onPress={() => router.push('/deposits')}
          >
            <Ionicons name="wallet-outline" size={24} color="#ffffff" />
            <Text style={[styles.actionText, styles.actionTextPrimary]}>
              Depositar
            </Text>
          </TouchableOpacity>

          {/* 2) Swap - PRIMARY (azul) */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.actionButtonPrimary,
              styles.actionButtonRight,
              { backgroundColor: theme.brandPrimary }
            ]}
            onPress={() => router.push('/swap')}
          >
            <Ionicons name="repeat-outline" size={24} color="#ffffff" />
            <Text style={[styles.actionText, styles.actionTextPrimary]}>
              Swap
            </Text>
          </TouchableOpacity>
        </View>

        {/* Fila 2: Retirar (outline) + Transferir (outline) */}
        <View style={styles.actionsRow}>
          {/* 3) Retirar - OUTLINE */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.actionButtonOutline,
              styles.actionButtonLeft,
              { borderColor: theme.border }
            ]}
            onPress={() => router.push('/withdrawals')}
          >
            <Ionicons name="arrow-up-outline" size={24} color={theme.brandPrimary} />
            <Text style={[styles.actionText, { color: theme.textPrimary }]}>
              Retirar
            </Text>
          </TouchableOpacity>

          {/* 4) Transferir - OUTLINE */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.actionButtonOutline,
              styles.actionButtonRight,
              { borderColor: theme.border }
            ]}
            onPress={() => router.push('/transfer')}
          >
            <MaterialCommunityIcons name="bank-transfer" size={24} color={theme.brandPrimary} />
            <Text style={[styles.actionText, { color: theme.textPrimary }]}>
              Transferir
            </Text>
          </TouchableOpacity>
        </View>
      </View>
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
  loadingText: {
    fontSize: fontSize.sm,
    marginTop: spacing.md,
  },
  balanceHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  balanceLabel: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  balanceAmountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  balanceCurrency: {
    fontSize: fontSize.xl,
    marginHorizontal: spacing.xs,
  },
  balanceAmount: {
    fontSize: fontSize.xxxl,
    fontWeight: 'bold',
  },
  balanceBTC: {
    fontSize: fontSize.sm,
  },
  actionsGrid: {
    // Contenedor principal
  },
  actionsRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
  },
  actionButtonLeft: {
    marginRight: spacing.xs,
  },
  actionButtonRight: {
    marginLeft: spacing.xs,
  },
  actionButtonOutline: {
    borderWidth: 1,
  },
  actionButtonPrimary: {
    // backgroundColor se aplica inline
  },
  actionText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  actionTextPrimary: {
    color: '#ffffff',
  },
});
