// mobile/app/(tabs)/index.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize } from '../../constants/theme';
import { useBalances } from '../../hooks/useBalances';
import { useMarket } from '../../hooks/useMarket';
import { useNotifications } from '../../hooks/useNotifications';
import BalanceHero from '../../components/home/BalanceHero';
import TopAssetsList from '../../components/home/TopAssetsList';
import TopGainersList from '../../components/home/TopGainersList';

export default function Home() {
  const { theme } = useTheme();
  const router = useRouter();

  // Hooks de datos
  const { portfolio, topAssets, isLoading: loadingBalances, refetch: refetchBalances } = useBalances();
  const { topGainers24h, isLoading: loadingMarket, refresh: refreshMarket } = useMarket();
  const { unreadCount } = useNotifications();

  const isLoading = loadingBalances || loadingMarket;

  const handleRefresh = async () => {
    await Promise.all([
      refetchBalances(),
      refreshMarket(),
    ]);
  };

  const handleNavigate = (path) => {
    router.push(path);
  };

  const handleCryptoClick = (symbol) => {
    router.push(`/swap?from=${symbol}&to=USDT`);
  };

  const handleViewMarket = () => {
    // Cuando tengas una pantalla de mercado, navegar ahí
    // Por ahora, navegar a swap
    router.push('/swap');
  };
  

console.log('=== HOME DEBUG ===');
console.log('Portfolio:', portfolio);
console.log('Top Assets:', topAssets);
console.log('Loading Balances:', loadingBalances);
console.log('Loading Market:', loadingMarket);
console.log('Top Gainers:', topGainers24h);
console.log('==================');

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header con notificaciones */}
      <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          Inicio
        </Text>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => handleNavigate('/notificaciones')}
        >
          <Text style={[styles.notificationIcon, { color: theme.textPrimary }]}>🔔</Text>
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.danger }]}>
              <Text style={styles.badgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Contenido principal */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={theme.success}
          />
        }
      >
        {isLoading && !portfolio.totalUSDT ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.success} />
            <Text style={[styles.loadingText, { color: theme.textMuted }]}>
              Cargando...
            </Text>
          </View>
        ) : (
          <>
            {/* Balance Hero */}
            <BalanceHero
              totalUSDT={portfolio.totalUSDT}
              totalBTC={portfolio.totalBTC}
              btcPriceError={portfolio.btcPriceError}
              onNavigate={handleNavigate}
            />

            {/* Top Assets */}
            <TopAssetsList
              assets={topAssets}
              onNavigate={handleNavigate}
            />

            {/* Top Gainers */}
            <TopGainersList
              gainers={topGainers24h}
              onCryptoClick={handleCryptoClick}
              onViewMarket={handleViewMarket}
            />
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
  },
  notificationButton: {
    position: 'relative',
    padding: spacing.xs,
  },
  notificationIcon: {
    fontSize: fontSize.xl,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.base,
  },
});