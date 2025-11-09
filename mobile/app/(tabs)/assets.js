// mobile/app/(tabs)/assets.js
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../constants/theme';
import { useBalances } from '../../hooks/useBalances';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

export default function AssetsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [sortBy, setSortBy] = useState('value'); // 'value', 'change', 'name'
  const [viewMode, setViewMode] = useState('expanded'); // 'expanded', 'compact'

  const {
    enrichedBalances,
    totalUSDT,
    totalBTC,
    isLoading,
    hideSmallBalances,
    setHideSmallBalances,
    refetch,
    marketDataError,
  } = useBalances();

  // Ordenar balances según criterio seleccionado
  const sortedBalances = useMemo(() => {
    const copy = [...enrichedBalances];
    if (sortBy === 'value') return copy.sort((a, b) => b.valueInUSDT - a.valueInUSDT);
    if (sortBy === 'change') return copy.sort((a, b) => (b.priceChange24h || 0) - (a.priceChange24h || 0));
    if (sortBy === 'name') return copy.sort((a, b) => a.crypto.symbol.localeCompare(b.crypto.symbol));
    return copy;
  }, [enrichedBalances, sortBy]);

  // Renderizar item de balance
  const renderBalanceItem = ({ item }) => {
    const handlePress = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({
        pathname: '/crypto-detail',
        params: { 
          cryptoId: item.crypto.id,
          symbol: item.crypto.symbol,
        }
      });
    };

    if (viewMode === 'compact') {
      // Vista compacta
      return (
        <TouchableOpacity 
          activeOpacity={0.7}
          onPress={handlePress}
        >
          <Card style={styles.balanceCardCompact}>
            <View style={styles.balanceRowCompact}>
              {/* Logo */}
              <View style={styles.cryptoIconContainerCompact}>
                {item.crypto.iconUrl ? (
                  <Image
                    source={{ 
                      uri: item.crypto.iconUrl.replace('/svg/color/', '/32/color/').replace('.svg', '.png')
                    }}
                    style={styles.cryptoImageCompact}
                    resizeMode="contain"
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="currency-usd"
                    size={24}
                    color={theme.brandPrimary}
                  />
                )}
              </View>

              {/* Símbolo */}
              <Text style={[styles.cryptoSymbolCompact, { color: theme.textPrimary }]}>
                {item.crypto.symbol}
              </Text>

              {/* Spacer */}
              <View style={{ flex: 1 }} />

              {/* Variación 24h */}
              {item.priceChange24h !== undefined && (
                <View style={[
                  styles.changeBadgeSmall, 
                  { backgroundColor: item.priceChange24h >= 0 ? theme.buyBg : theme.sellBg }
                ]}>
                  <Text style={[styles.changeBadgeTextSmall, { 
                    color: item.priceChange24h >= 0 ? theme.buy : theme.sell 
                  }]}>
                    {item.priceChange24h >= 0 ? '+' : ''}{item.priceChange24h.toFixed(2)}%
                  </Text>
                </View>
              )}

              {/* Valor */}
              <Text style={[styles.balanceValueCompact, { color: theme.textPrimary }]}>
                ${item.valueInUSDT.toLocaleString('en-US', { 
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0 
                })}
              </Text>

              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </View>
          </Card>
        </TouchableOpacity>
      );
    }

    // Vista expandida
    return (
      <TouchableOpacity 
        activeOpacity={0.7}
        onPress={handlePress}
      >
        <Card style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            {/* Logo */}
            <View style={styles.cryptoIconContainer}>
              {item.crypto.iconUrl ? (
                <Image
                  source={{ 
                    uri: item.crypto.iconUrl.replace('/svg/color/', '/32/color/').replace('.svg', '.png')
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
              {/* Badge de variación 24h */}
              {item.priceChange24h !== undefined && (
                <View style={[
                  styles.changeBadge, 
                  { backgroundColor: item.priceChange24h >= 0 ? theme.buyBg : theme.sellBg }
                ]}>
                  <Ionicons 
                    name={item.priceChange24h >= 0 ? 'trending-up' : 'trending-down'} 
                    size={10} 
                    color={item.priceChange24h >= 0 ? theme.buy : theme.sell} 
                  />
                  <Text style={[styles.changeBadgeText, { 
                    color: item.priceChange24h >= 0 ? theme.buy : theme.sell 
                  }]}>
                    {item.priceChange24h >= 0 ? '+' : ''}{item.priceChange24h.toFixed(2)}%
                  </Text>
                </View>
              )}
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

  // Skeleton loader
  const renderSkeletonItem = () => (
    <Card style={styles.balanceCard}>
      <View style={styles.balanceRow}>
        <View style={[styles.skeleton, styles.skeletonIcon, { backgroundColor: theme.backgroundSecondary }]} />
        <View style={styles.balanceInfo}>
          <View style={[styles.skeleton, styles.skeletonText, { backgroundColor: theme.backgroundSecondary }]} />
          <View style={[styles.skeleton, styles.skeletonTextSmall, { backgroundColor: theme.backgroundSecondary }]} />
        </View>
        <View style={styles.balanceValues}>
          <View style={[styles.skeleton, styles.skeletonText, { backgroundColor: theme.backgroundSecondary }]} />
          <View style={[styles.skeleton, styles.skeletonTextSmall, { backgroundColor: theme.backgroundSecondary }]} />
        </View>
      </View>
    </Card>
  );

  const renderSkeletonLoader = () => (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3, 4].map((_, index) => (
        <View key={index} style={{ marginBottom: spacing.sm }}>
          {renderSkeletonItem()}
        </View>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header fijo */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          Mis Activos
        </Text>
        <View style={styles.headerActions}>
          {/* Toggle vista compacta/expandida */}
          <TouchableOpacity 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setViewMode(viewMode === 'expanded' ? 'compact' : 'expanded');
            }}
            style={styles.headerButton}
          >
            <Ionicons 
              name={viewMode === 'expanded' ? 'list' : 'grid'} 
              size={24} 
              color={theme.brandPrimary} 
            />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              refetch();
            }}
            style={styles.headerButton}
          >
            <Ionicons name="refresh" size={24} color={theme.brandPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={theme.brandPrimary}
          />
        }
      >
        {isLoading && sortedBalances.length === 0 ? (
          // Skeleton loader
          <View>
            <Card elevated style={styles.totalCard}>
              <View style={[styles.skeleton, styles.skeletonTotal, { backgroundColor: theme.backgroundSecondary }]} />
            </Card>
            {renderSkeletonLoader()}
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

            {/* Advertencia si falló la carga de datos de mercado */}
            {marketDataError && (
              <Card style={[styles.warningCard, { backgroundColor: theme.warningBg }]}>
                <View style={styles.warningContent}>
                  <Ionicons name="warning" size={20} color={theme.warning} />
                  <Text style={[styles.warningText, { color: theme.warning }]}>
                    No se pudieron cargar las variaciones de precio. Los porcentajes mostrados pueden no estar actualizados.
                  </Text>
                </View>
              </Card>
            )}

            {/* Botón de Depositar */}
            <View style={styles.depositButtonContainer}>
              <Button 
                variant="primary" 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

            {/* Controles de filtrado y ordenamiento */}
            <View style={styles.controlsContainer}>
              {/* Ordenamiento */}
              <View style={styles.sortContainer}>
                <Text style={[styles.controlLabel, { color: theme.textSecondary }]}>
                  Ordenar:
                </Text>
                <View style={styles.sortButtons}>
                  <TouchableOpacity
                    style={[
                      styles.sortButton,
                      sortBy === 'value' && { backgroundColor: theme.brandPrimary }
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSortBy('value');
                    }}
                  >
                    <Text style={[
                      styles.sortButtonText,
                      { color: sortBy === 'value' ? '#ffffff' : theme.textSecondary }
                    ]}>
                      Valor
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.sortButton,
                      sortBy === 'change' && { backgroundColor: theme.brandPrimary }
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSortBy('change');
                    }}
                  >
                    <Text style={[
                      styles.sortButtonText,
                      { color: sortBy === 'change' ? '#ffffff' : theme.textSecondary }
                    ]}>
                      Cambio
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.sortButton,
                      sortBy === 'name' && { backgroundColor: theme.brandPrimary }
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSortBy('name');
                    }}
                  >
                    <Text style={[
                      styles.sortButtonText,
                      { color: sortBy === 'name' ? '#ffffff' : theme.textSecondary }
                    ]}>
                      Nombre
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Toggle para ocultar balances pequeños */}
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setHideSmallBalances(!hideSmallBalances);
                }}
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
                Criptomonedas ({sortedBalances.length})
              </Text>

              {sortedBalances.length > 0 ? (
                <View style={styles.flashListContainer}>
                  <FlashList
                    data={sortedBalances}
                    renderItem={renderBalanceItem}
                    keyExtractor={(item) => item.criptomonedaId.toString()}
                    estimatedItemSize={viewMode === 'compact' ? 64 : 120}
                    ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
                  />
                </View>
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
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerButton: {
    padding: spacing.xs,
  },
  scrollView: {
    flex: 1,
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

  // Warning Card
  warningCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  warningContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  warningText: {
    fontSize: fontSize.xs,
    flex: 1,
    lineHeight: 18,
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

  // Actions Row
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

  // Controls (Sort & Filter)
  controlsContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  controlLabel: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  sortButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
    flex: 1,
  },
  sortButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    flex: 1,
    alignItems: 'center',
  },
  sortButtonText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
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
  flashListContainer: {
    minHeight: 400,
  },

  // Balance Card - Expanded
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
  cryptoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  cryptoSymbol: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
  },
  cryptoName: {
    fontSize: fontSize.sm,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  changeBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
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
    marginBottom: 2,
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

  // Balance Card - Compact
  balanceCardCompact: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  balanceRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cryptoIconContainerCompact: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cryptoImageCompact: {
    width: 28,
    height: 28,
  },
  cryptoSymbolCompact: {
    fontSize: fontSize.base,
    fontWeight: '600',
    minWidth: 50,
  },
  changeBadgeSmall: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  changeBadgeTextSmall: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  balanceValueCompact: {
    fontSize: fontSize.base,
    fontWeight: '600',
    marginRight: spacing.xs,
  },

  // Skeleton Loader
  skeletonContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  skeleton: {
    borderRadius: borderRadius.sm,
    opacity: 0.3,
  },
  skeletonTotal: {
    height: 60,
    width: '60%',
    alignSelf: 'center',
  },
  skeletonIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    marginRight: spacing.md,
  },
  skeletonText: {
    height: 16,
    width: '70%',
    marginBottom: 6,
  },
  skeletonTextSmall: {
    height: 14,
    width: '50%',
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