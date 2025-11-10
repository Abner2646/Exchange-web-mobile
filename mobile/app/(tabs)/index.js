// mobile/app/(tabs)/index.js
import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useBalances } from '../../hooks/useBalances';
import { useMarket } from '../../hooks/useMarket';
import { spacing, fontSize } from '../../constants/theme';
import BalanceCard from '../../components/home/BalanceCard';
import TopAssets from '../../components/home/TopAssets';
import TopMoversSection from '../../components/home/TopMoversSection';
import MarketList from '../../components/home/MarketList';
import NotificationBell from '../../components/notifications/NotificationBell';
import { BalanceCardSkeleton } from '../../components/common/SkeletonLoader';

export default function HomeScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();

  // ⭐ Primero cargar market data
  const {
    allMarketData,
    topGainers24h,
    topLosers24h,
    topGainers7d,
    topLosers7d,
    isLoading: loadingMarket,
    marketDataError,
    refresh: refreshMarket,
  } = useMarket();

  // ⭐ Pasar allMarketData a useBalances
  const { 
    portfolio, 
    topAssets, 
    isLoading: loadingBalances, 
    refetch: refetchBalances 
  } = useBalances(allMarketData);

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (user) {
        await refetchBalances();
      }
      await refreshMarket();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.brandPrimary}
            colors={[theme.brandPrimary]}
            title="Actualizando..."
            titleColor={theme.textSecondary}
          />
        }
      >
        {/* Header con notificaciones */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: theme.textPrimary }]}>
              {user ? `Hola, ${user.username}` : 'Bienvenido'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {user ? 'Tu dashboard de criptomonedas' : 'Exchange de criptomonedas'}
            </Text>
          </View>
          
          {user && (
            <View style={styles.headerRight}>
              <NotificationBell />
            </View>
          )}
        </View>

        {/* Usuario Autenticado */}
        {user && (
          <>
            {loadingBalances ? (
              <BalanceCardSkeleton />
            ) : (
              <BalanceCard
                totalUSDT={portfolio.totalUSDT}
                totalBTC={portfolio.totalBTC}
                btcPriceError={portfolio.btcPriceError}
                isLoading={false}
              />
            )}

            <TopAssets assets={topAssets} isLoading={loadingBalances} />

            <TopMoversSection
              gainers24h={topGainers24h}
              losers24h={topLosers24h}
              gainers7d={topGainers7d}
              losers7d={topLosers7d}
              isLoading={loadingMarket}
              error={marketDataError}
              onRetry={refreshMarket}
            />
          </>
        )}

        {/* MarketList con Infinite Scroll */}
        <MarketList
          allMarketData={allMarketData}
          isLoading={loadingMarket}
          error={marketDataError}
          onRetry={refreshMarket}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    marginTop: spacing.xs,
  },
  greeting: {
    fontSize: fontSize.xxxl,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: fontSize.md,
    marginTop: spacing.xs,
  },
});