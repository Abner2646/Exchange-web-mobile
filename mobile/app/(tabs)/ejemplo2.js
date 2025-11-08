import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize, borderRadius, shadows } from '../../constants/theme';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

// 🎯 MOCK DATA - Sin APIs externas
const MOCK_CRYPTOS = [
  {
    id: 1,
    symbol: 'BTC',
    name: 'Bitcoin',
    price: 43250.80,
    change24h: 5.24,
    icon: 'bitcoin',
  },
  {
    id: 2,
    symbol: 'ETH',
    name: 'Ethereum',
    price: 2280.45,
    change24h: -2.15,
    icon: 'ethereum',
  },
  {
    id: 3,
    symbol: 'BNB',
    name: 'Binance Coin',
    price: 312.90,
    change24h: 3.87,
    icon: 'currency-usd',
  },
  {
    id: 4,
    symbol: 'SOL',
    name: 'Solana',
    price: 98.32,
    change24h: -1.45,
    icon: 'alpha-s-circle',
  },
];

const MOCK_PORTFOLIO = {
  totalBalance: 12580.45,
  change24h: 4.32,
  btcBalance: 0.15,
  usdtBalance: 5430.20,
};

export default function MarketModelScreen() {
  const { theme } = useTheme();
  const [selectedTab, setSelectedTab] = useState('all'); // 'all', 'favorites', 'gainers'

  // 🎨 Renderizar item de crypto
  const renderCryptoItem = ({ item }) => {
    const isPositive = item.change24h >= 0;
    const changeColor = isPositive ? theme.buy : theme.sell;
    const changeIcon = isPositive ? 'trending-up' : 'trending-down';

    return (
      <TouchableOpacity activeOpacity={0.7}>
        <Card style={styles.cryptoCard}>
          <View style={styles.cryptoRow}>
            {/* Icono de crypto */}
            <View style={styles.cryptoIconContainer}>
              <MaterialCommunityIcons
                name={item.icon}
                size={32}
                color={theme.brandPrimary}
              />
            </View>

            {/* Info de crypto */}
            <View style={styles.cryptoInfo}>
              <Text style={[styles.cryptoSymbol, { color: theme.textPrimary }]}>
                {item.symbol}
              </Text>
              <Text style={[styles.cryptoName, { color: theme.textSecondary }]}>
                {item.name}
              </Text>
            </View>

            {/* Precio y cambio */}
            <View style={styles.cryptoPriceContainer}>
              <Text style={[styles.cryptoPrice, { color: theme.textPrimary }]}>
                ${item.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
              <View style={styles.changeRow}>
                <Ionicons name={changeIcon} size={14} color={changeColor} />
                <Text style={[styles.changeText, { color: changeColor }]}>
                  {isPositive ? '+' : ''}{item.change24h.toFixed(2)}%
                </Text>
              </View>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView style={styles.scrollView}>
        {/* 📊 Header con Portfolio Balance */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
            Mercado
          </Text>
          <TouchableOpacity>
            <Ionicons name="search" size={24} color={theme.textMuted} />
          </TouchableOpacity>
        </View>

        {/* 💰 Portfolio Card */}
        <Card elevated style={styles.portfolioCard}>
          <Text style={[styles.portfolioLabel, { color: theme.textSecondary }]}>
            Balance Total
          </Text>
          <Text style={[styles.portfolioBalance, { color: theme.textPrimary }]}>
            ${MOCK_PORTFOLIO.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
          
          {/* Cambio 24h */}
          <View style={styles.portfolioChangeRow}>
            <Ionicons 
              name="trending-up" 
              size={16} 
              color={theme.buy} 
            />
            <Text style={[styles.portfolioChange, { color: theme.buy }]}>
              +${(MOCK_PORTFOLIO.totalBalance * MOCK_PORTFOLIO.change24h / 100).toFixed(2)} ({MOCK_PORTFOLIO.change24h}%)
            </Text>
            <Text style={[styles.portfolioTime, { color: theme.textMuted }]}>
              últimas 24h
            </Text>
          </View>

          {/* Holdings rápidos */}
          <View style={styles.holdingsRow}>
            <View style={styles.holdingItem}>
              <MaterialCommunityIcons name="bitcoin" size={20} color={theme.brandPrimary} />
              <Text style={[styles.holdingText, { color: theme.textSecondary }]}>
                {MOCK_PORTFOLIO.btcBalance} BTC
              </Text>
            </View>
            <View style={styles.holdingItem}>
              <Ionicons name="wallet" size={20} color={theme.brandPrimary} />
              <Text style={[styles.holdingText, { color: theme.textSecondary }]}>
                ${MOCK_PORTFOLIO.usdtBalance.toLocaleString('en-US')} USDT
              </Text>
            </View>
          </View>
        </Card>

        {/* 🎯 Action Buttons */}
        <View style={styles.actionsRow}>
          <View style={styles.actionButton}>
            <Button variant="primary" onPress={() => {}}>
              <View style={styles.buttonContent}>
                <Ionicons name="card" size={18} color="#ffffff" />
                <Text style={styles.buttonText}>Comprar</Text>
              </View>
            </Button>
          </View>
          <View style={styles.actionButton}>
            <Button variant="outline" onPress={() => {}}>
              <View style={styles.buttonContent}>
                <Ionicons name="swap-horizontal" size={18} color={theme.brandPrimary} />
                <Text style={[styles.buttonText, { color: theme.brandPrimary }]}>
                  Intercambiar
                </Text>
              </View>
            </Button>
          </View>
        </View>

        {/* 📑 Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              selectedTab === 'all' && { 
                borderBottomColor: theme.brandPrimary,
                borderBottomWidth: 2,
              }
            ]}
            onPress={() => setSelectedTab('all')}
          >
            <Text
              style={[
                styles.tabText,
                { color: selectedTab === 'all' ? theme.brandPrimary : theme.textSecondary }
              ]}
            >
              Todas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              selectedTab === 'favorites' && { 
                borderBottomColor: theme.brandPrimary,
                borderBottomWidth: 2,
              }
            ]}
            onPress={() => setSelectedTab('favorites')}
          >
            <Ionicons 
              name="star" 
              size={16} 
              color={selectedTab === 'favorites' ? theme.brandPrimary : theme.textSecondary} 
            />
            <Text
              style={[
                styles.tabText,
                { color: selectedTab === 'favorites' ? theme.brandPrimary : theme.textSecondary }
              ]}
            >
              Favoritos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              selectedTab === 'gainers' && { 
                borderBottomColor: theme.brandPrimary,
                borderBottomWidth: 2,
              }
            ]}
            onPress={() => setSelectedTab('gainers')}
          >
            <Text
              style={[
                styles.tabText,
                { color: selectedTab === 'gainers' ? theme.brandPrimary : theme.textSecondary }
              ]}
            >
              Ganadores
            </Text>
          </TouchableOpacity>
        </View>

        {/* 💱 Lista de Criptomonedas */}
        <View style={styles.listContainer}>
          <FlatList
            data={MOCK_CRYPTOS}
            renderItem={renderCryptoItem}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
          />
        </View>

        {/* 📢 Promotional Card */}
        <Card style={[styles.promoCard, { backgroundColor: theme.brandTertiary }]}>
          <View style={styles.promoContent}>
            <Ionicons name="gift" size={32} color={theme.brandPrimary} />
            <View style={styles.promoText}>
              <Text style={[styles.promoTitle, { color: theme.textPrimary }]}>
                Oferta Especial
              </Text>
              <Text style={[styles.promoDescription, { color: theme.textSecondary }]}>
                0% de comisión en tu primera compra
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.brandPrimary} />
          </View>
        </Card>

        {/* 🎨 Ejemplo de diferentes estados de botones */}
        <Card style={styles.examplesCard}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Ejemplos de Botones
          </Text>
          
          <View style={styles.buttonExample}>
            <Button variant="primary" onPress={() => {}}>
              Botón Principal (Azul)
            </Button>
          </View>

          <View style={styles.buttonExample}>
            <Button variant="success" onPress={() => {}}>
              Botón de Compra (Verde)
            </Button>
          </View>

          <View style={styles.buttonExample}>
            <Button variant="danger" onPress={() => {}}>
              Botón de Venta (Rojo)
            </Button>
          </View>

          <View style={styles.buttonExample}>
            <Button variant="outline" onPress={() => {}}>
              Botón Outline
            </Button>
          </View>

          <View style={styles.buttonExample}>
            <Button variant="primary" loading={true}>
              Cargando...
            </Button>
          </View>
        </Card>

        {/* 📊 Stats Cards */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Ionicons name="trending-up" size={24} color={theme.buy} />
            <Text style={[styles.statValue, { color: theme.textPrimary }]}>
              24
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Ganadores
            </Text>
          </Card>

          <Card style={styles.statCard}>
            <Ionicons name="trending-down" size={24} color={theme.sell} />
            <Text style={[styles.statValue, { color: theme.textPrimary }]}>
              12
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Perdedores
            </Text>
          </Card>
        </View>

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
  
  // Portfolio Card
  portfolioCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  portfolioLabel: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  portfolioBalance: {
    fontSize: fontSize.xxxl,
    fontWeight: 'bold',
    marginBottom: spacing.sm,
  },
  portfolioChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  portfolioChange: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  portfolioTime: {
    fontSize: fontSize.xs,
  },
  holdingsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.1)',
  },
  holdingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  holdingText: {
    fontSize: fontSize.sm,
  },

  // Action Buttons
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.lg,
  },
  tab: {
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tabText: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },

  // Crypto List
  listContainer: {
    paddingHorizontal: spacing.md,
  },
  cryptoCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  cryptoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cryptoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cryptoInfo: {
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
  cryptoPriceContainer: {
    alignItems: 'flex-end',
  },
  cryptoPrice: {
    fontSize: fontSize.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },

  // Promo Card
  promoCard: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.lg,
    padding: spacing.md,
  },
  promoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  promoText: {
    flex: 1,
  },
  promoTitle: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  promoDescription: {
    fontSize: fontSize.sm,
  },

  // Examples Card
  examplesCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    marginBottom: spacing.md,
  },
  buttonExample: {
    marginBottom: spacing.md,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    marginVertical: spacing.xs,
  },
  statLabel: {
    fontSize: fontSize.sm,
  },
});