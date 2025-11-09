// mobile/app/crypto-detail.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../constants/theme';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function CryptoDetailScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { cryptoId, symbol } = useLocalSearchParams();

  // TODO: Obtener datos reales con un hook personalizado
  const mockCryptoData = {
    symbol: symbol || 'BTC',
    name: 'Bitcoin',
    balance: 0.9,
    valueUSD: 92099.39,
    price: 102332.66,
    priceChange24h: 5.24,
    iconUrl: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/btc.png',
    depositAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  };

  const handleDeposit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Depositar', 'Próximamente: Funcionalidad de depósito');
  };

  const handleWithdraw = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Retirar', 'Próximamente: Funcionalidad de retiro');
  };

  const handleTransfer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Transferir', 'Próximamente: Funcionalidad de transferencia');
  };

  const handleCopyAddress = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copiado', 'Dirección copiada al portapapeles');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          {mockCryptoData.name}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Balance Card */}
        <Card elevated style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            {mockCryptoData.iconUrl && (
              <Image
                source={{ uri: mockCryptoData.iconUrl }}
                style={styles.cryptoIcon}
                resizeMode="contain"
              />
            )}
            <View style={styles.balanceInfo}>
              <Text style={[styles.balanceLabel, { color: theme.textSecondary }]}>
                Balance de {mockCryptoData.symbol}
              </Text>
              <Text style={[styles.balanceAmount, { color: theme.textPrimary }]}>
                {mockCryptoData.balance.toFixed(8)} {mockCryptoData.symbol}
              </Text>
              <Text style={[styles.balanceValueUSD, { color: theme.textSecondary }]}>
                ≈ ${mockCryptoData.valueUSD.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            </View>
          </View>

          {/* Price Info */}
          <View style={styles.priceInfo}>
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: theme.textMuted }]}>
                Precio actual:
              </Text>
              <Text style={[styles.priceValue, { color: theme.textPrimary }]}>
                ${mockCryptoData.price.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            </View>
            <View style={styles.changeRow}>
              <Ionicons
                name={mockCryptoData.priceChange24h >= 0 ? 'trending-up' : 'trending-down'}
                size={16}
                color={mockCryptoData.priceChange24h >= 0 ? theme.buy : theme.sell}
              />
              <Text
                style={[
                  styles.changeText,
                  { color: mockCryptoData.priceChange24h >= 0 ? theme.buy : theme.sell },
                ]}
              >
                {mockCryptoData.priceChange24h >= 0 ? '+' : ''}
                {mockCryptoData.priceChange24h.toFixed(2)}% (24h)
              </Text>
            </View>
          </View>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <View style={styles.actionButton}>
            <Button variant="primary" onPress={handleDeposit}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="add-circle" size={20} color="#ffffff" />
                <Text style={styles.actionButtonText}>Depositar</Text>
              </View>
            </Button>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <View style={styles.actionButtonSmall}>
            <Button variant="outline" onPress={handleTransfer}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="swap-horizontal" size={18} color={theme.brandPrimary} />
                <Text style={[styles.actionButtonTextSmall, { color: theme.brandPrimary }]}>
                  Transferir
                </Text>
              </View>
            </Button>
          </View>
          <View style={styles.actionButtonSmall}>
            <Button variant="outline" onPress={handleWithdraw}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="arrow-up-circle-outline" size={18} color={theme.brandPrimary} />
                <Text style={[styles.actionButtonTextSmall, { color: theme.brandPrimary }]}>
                  Retirar
                </Text>
              </View>
            </Button>
          </View>
        </View>

        {/* Deposit Address */}
        <Card style={styles.addressCard}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Dirección de Depósito
          </Text>
          <TouchableOpacity
            style={[styles.addressContainer, { backgroundColor: theme.backgroundSecondary }]}
            onPress={handleCopyAddress}
            activeOpacity={0.7}
          >
            <Text style={[styles.addressText, { color: theme.textPrimary }]} numberOfLines={1}>
              {mockCryptoData.depositAddress}
            </Text>
            <Ionicons name="copy-outline" size={20} color={theme.brandPrimary} />
          </TouchableOpacity>
          <Text style={[styles.addressHint, { color: theme.textMuted }]}>
            Toca para copiar la dirección
          </Text>
        </Card>

        {/* Recent Transactions */}
        <Card style={styles.transactionsCard}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Transacciones Recientes
          </Text>
          <View style={styles.emptyTransactions}>
            <Ionicons name="time-outline" size={48} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No hay transacciones recientes
            </Text>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },

  // Balance Card
  balanceCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cryptoIcon: {
    width: 48,
    height: 48,
    marginRight: spacing.md,
  },
  balanceInfo: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  balanceAmount: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  balanceValueUSD: {
    fontSize: fontSize.md,
  },
  priceInfo: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.1)',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  priceLabel: {
    fontSize: fontSize.sm,
  },
  priceValue: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  changeText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },

  // Actions
  actionsContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  actionButton: {
    width: '100%',
  },
  actionButtonSmall: {
    flex: 1,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#ffffff',
  },
  actionButtonTextSmall: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },

  // Address Card
  addressCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    marginBottom: spacing.md,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  addressText: {
    fontSize: fontSize.sm,
    fontFamily: 'monospace',
    flex: 1,
    marginRight: spacing.sm,
  },
  addressHint: {
    fontSize: fontSize.xs,
    textAlign: 'center',
  },

  // Transactions Card
  transactionsCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.xl,
    padding: spacing.lg,
  },
  emptyTransactions: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.base,
    marginTop: spacing.md,
  },
});