// mobile/app/(tabs)/assets.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../constants/theme';
import { useBalances } from '../../hooks/useBalances';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

export default function AssetsScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const {
    enrichedBalances,
    totalUSDT,
    totalBTC,
    isLoading,
    hideSmallBalances,
    setHideSmallBalances,
    refetch,
  } = useBalances();

  // Renderizar item de balance
  const renderBalanceItem = ({ item }) => {
    return (
      <TouchableOpacity 
        activeOpacity={0.7}
        onPress={() => {
          // Navegar a pantalla de detalle (a implementar)
          Alert.alert(
            item.crypto.nombre,
            `Próximamente: Vista de detalle de ${item.crypto.symbol}`
          );
        }}
      >
        <Card style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            {/* Logo real de crypto */}
            <View style={styles.cryptoIconContainer}>
              {item.crypto.iconUrl ? (
                <Image
                  source={{ 
                    uri: item.crypto.iconUrl.replace('/svg/color/', '/128/color/').replace('.svg', '.png')
                  }}
                  style={styles.cryptoImage}
                  resizeMode="contain"
                />
              ) : (
                <MaterialCommunityIcons
                  name="currency-usd"
                  size={28}
                  color={theme.brandPrimary}
                />
              )}
            </View>

            {/* Info de crypto */}
            <View style={styles.balanceInfo}>
              <Text style={[styles.cryptoSymbol, { color: theme.textPrimary }]}>
                {item.crypto.symbol}
              </Text>
              <Text style={[styles.cryptoName, { color: theme.textSecondary }]}>
                {item.crypto.nombre}
              </Text>
            </View>

            {/* Balance y valor */}
            <View style={styles.balanceValues}>
              <Text style={[styles.balanceAmount, { color: theme.textPrimary }]}>
                {parseFloat(item.balanceAmount).toFixed(8)} {item.crypto.symbol}
              </Text>
              <Text style={[styles.balanceValue, { color: theme.textSecondary }]}>
                ${item.valueInUSDT.toLocaleString('en-US', { 
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2 
                })}
              </Text>
            </View>

            {/* Icono de navegación */}
            <Ionicons 
              name="chevron-forward" 
              size={20} 
              color={theme.textMuted} 
            />
          </View>

          {/* Precio unitario */}
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: theme.textMuted }]}>
              Precio:
            </Text>
            <Text style={[styles.priceValue, { color: theme.textSecondary }]}>
              ${item.price.toLocaleString('en-US', { 
                minimumFractionDigits: 2,
                maximumFractionDigits: 8 
              })} USDT
            </Text>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  // Renderizar mensaje cuando no hay resultados
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="wallet-outline" size={64} color={theme.textMuted} />
      <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
        Sin activos
      </Text>
      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
        Deposita criptomonedas para comenzar
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header fijo */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          Mis Activos
        </Text>
        <TouchableOpacity onPress={refetch}>
          <Ionicons name="refresh" size={24} color={theme.brandPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.brandPrimary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Cargando activos...
            </Text>
          </View>
        ) : (
          <>
            {/* Balance Total Card */}
            <Card elevated style={styles.totalCard}>
              <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>
                Balance Total
              </Text>
              <Text style={[styles.totalAmount, { color: theme.textPrimary }]}>
                ${totalUSDT.toLocaleString('en-US', { 
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2 
                })}
              </Text>
              <View style={styles.totalBtcRow}>
                <MaterialCommunityIcons 
                  name="bitcoin" 
                  size={16} 
                  color={theme.textMuted} 
                />
                <Text style={[styles.totalBtc, { color: theme.textMuted }]}>
                  ≈ {totalBTC.toFixed(8)} BTC
                </Text>
              </View>
            </Card>

            {/* Botón de Depositar */}
            <View style={styles.depositButtonContainer}>
              <Button 
                variant="primary" 
                onPress={() => {
                  Alert.alert(
                    'Depositar',
                    'Próximamente: Funcionalidad de depósito'
                  );
                }}
              >
                <View style={styles.depositButtonContent}>
                  <Ionicons name="add-circle" size={20} color="#ffffff" />
                  <Text style={styles.depositButtonText}>Depositar</Text>
                </View>
              </Button>
            </View>

            {/* Botones de Transferir y Retirar */}
            <View style={styles.actionsRow}>
              <View style={styles.actionButton}>
                <Button 
                  variant="outline" 
                  onPress={() => {
                    Alert.alert(
                      'Transferir',
                      'Próximamente: Funcionalidad de transferencia'
                    );
                  }}
                >
                  <View style={styles.actionButtonContent}>
                    <Ionicons name="swap-horizontal" size={18} color={theme.brandPrimary} />
                    <Text style={[styles.actionButtonText, { color: theme.brandPrimary }]}>
                      Transferir
                    </Text>
                  </View>
                </Button>
              </View>
              <View style={styles.actionButton}>
                <Button 
                  variant="outline" 
                  onPress={() => {
                    Alert.alert(
                      'Retirar',
                      'Próximamente: Funcionalidad de retiro'
                    );
                  }}
                >
                  <View style={styles.actionButtonContent}>
                    <Ionicons name="arrow-up-circle-outline" size={18} color={theme.brandPrimary} />
                    <Text style={[styles.actionButtonText, { color: theme.brandPrimary }]}>
                      Retirar
                    </Text>
                  </View>
                </Button>
              </View>
            </View>

            {/* Toggle para ocultar balances pequeños */}
            <View style={styles.filterContainer}>
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setHideSmallBalances(!hideSmallBalances)}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={hideSmallBalances ? 'eye-off' : 'eye'} 
                  size={20} 
                  color={hideSmallBalances ? theme.brandPrimary : theme.textMuted} 
                />
                <Text 
                  style={[
                    styles.filterText, 
                    { color: hideSmallBalances ? theme.brandPrimary : theme.textSecondary }
                  ]}
                >
                  {hideSmallBalances ? 'Mostrar todos' : 'Ocultar pequeños'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Lista de balances */}
            <View style={styles.listContainer}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                Criptomonedas ({enrichedBalances.length})
              </Text>

              {enrichedBalances.length > 0 ? (
                <FlatList
                  data={enrichedBalances}
                  renderItem={renderBalanceItem}
                  keyExtractor={(item) => item.criptomonedaId.toString()}
                  scrollEnabled={false}
                  ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
                />
              ) : (
                renderEmptyState()
              )}
            </View>
          </>
        )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize.xxxl,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    fontSize: fontSize.base,
    marginTop: spacing.md,
  },

  // Total Card
  totalCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  totalAmount: {
    fontSize: fontSize.xxxl,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  totalBtcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  totalBtc: {
    fontSize: fontSize.sm,
  },

  // Deposit Button
  depositButtonContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  depositButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  depositButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Actions Row (Transferir y Retirar)
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },

  // Filter Container
  filterContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  filterText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },

  // List
  listContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginBottom: spacing.md,
  },

  // Balance Card
  balanceCard: {
    padding: spacing.md,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cryptoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cryptoImage: {
    width: 40,
    height: 40,
  },
  balanceInfo: {
    flex: 1,
  },
  cryptoSymbol: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  cryptoName: {
    fontSize: fontSize.sm,
  },
  balanceValues: {
    alignItems: 'flex-end',
    marginRight: spacing.sm,
  },
  balanceAmount: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: 2,
  },
  balanceValue: {
    fontSize: fontSize.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.1)',
  },
  priceLabel: {
    fontSize: fontSize.xs,
  },
  priceValue: {
    fontSize: fontSize.xs,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: fontSize.base,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});