// mobile/components/trading/CompactOrderBook.js
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize } from '../../constants/theme';
import Card from '../ui/Card';

const CompactOrderBook = ({ orderBook, pair, loading }) => {
  const { theme } = useTheme();
  const { bids = [], asks = [] } = orderBook;

  // Top 5 de cada lado
  const topAsks = useMemo(() => asks.slice(0, 5).reverse(), [asks]);
  const topBids = useMemo(() => bids.slice(0, 5), [bids]);

  // Calcular spread
  const spread = useMemo(() => {
    if (bids.length === 0 || asks.length === 0) return null;
    const bestBid = parseFloat(bids[0]?.price || 0);
    const bestAsk = parseFloat(asks[0]?.price || 0);
    const diff = bestAsk - bestBid;
    const percentage = bestBid > 0 ? (diff / bestBid) * 100 : 0;
    return { diff, percentage };
  }, [bids, asks]);

  const formatPrice = (price) => {
    return parseFloat(price).toFixed(pair?.pricePrecision || 2);
  };

  const formatQuantity = (quantity) => {
    return parseFloat(quantity).toFixed(pair?.quantityPrecision || 4);
  };

  const calculatePercentage = (orders, currentOrder) => {
    const maxTotal = orders.reduce((sum, order) => {
      return sum + (parseFloat(order.totalValue || 0) || (order.quantity * order.price));
    }, 0);
    const currentTotal = parseFloat(currentOrder.totalValue || 0) || (currentOrder.quantity * currentOrder.price);
    return maxTotal > 0 ? (currentTotal / maxTotal) * 100 : 0;
  };

  const renderOrderRow = (order, index, isBid) => {
    const percentage = calculatePercentage(isBid ? topBids : topAsks, order);
    
    return (
      <View key={index} style={styles.orderRow}>
        <View 
          style={[
            styles.orderBar,
            {
              width: `${percentage}%`,
              backgroundColor: isBid 
                ? `${theme.buyBg}80` 
                : `${theme.sellBg}80`,
            }
          ]}
        />
        <Text 
          style={[
            styles.orderPrice,
            { color: isBid ? theme.buy : theme.sell }
          ]}
        >
          {formatPrice(order.price)}
        </Text>
        <Text style={[styles.orderQuantity, { color: theme.textSecondary }]}>
          {formatQuantity(order.quantity)}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <Card style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.brandPrimary} />
          <Text style={[styles.loadingText, { color: theme.textMuted }]}>
            Cargando order book...
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          Order Book
        </Text>
        {spread && (
          <View style={styles.spreadBadge}>
            <Text style={[styles.spreadText, { color: theme.textSecondary }]}>
              Spread: {spread.percentage.toFixed(2)}%
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.columnHeaders, { borderBottomColor: theme.border }]}>
        <Text style={[styles.columnHeader, { color: theme.textSecondary }]}>
          Precio
        </Text>
        <Text style={[styles.columnHeader, { color: theme.textSecondary }]}>
          Cantidad
        </Text>
      </View>

      {/* Asks (Ventas) */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.sell }]}>
          Ventas
        </Text>
        {topAsks.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            Sin órdenes
          </Text>
        ) : (
          topAsks.map((ask, index) => renderOrderRow(ask, index, false))
        )}
      </View>

      {/* Precio actual */}
      {pair && (
        <View style={[styles.currentPrice, { borderTopColor: theme.border, borderBottomColor: theme.border }]}>
          <Text style={[styles.currentPriceLabel, { color: theme.textMuted }]}>
            Precio actual
          </Text>
          <Text 
            style={[
              styles.currentPriceValue,
              { color: parseFloat(pair.priceChange24h) >= 0 ? theme.buy : theme.sell }
            ]}
          >
            {formatPrice(pair.lastPrice)}
          </Text>
        </View>
      )}

      {/* Bids (Compras) */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.buy }]}>
          Compras
        </Text>
        {topBids.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            Sin órdenes
          </Text>
        ) : (
          topBids.map((bid, index) => renderOrderRow(bid, index, true))
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  spreadBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  spreadText: {
    fontSize: fontSize.xs,
  },
  columnHeaders: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    marginBottom: spacing.xs,
  },
  columnHeader: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  section: {
    marginVertical: spacing.xs,
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  orderRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    position: 'relative',
  },
  orderBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.3,
  },
  orderPrice: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: '500',
    zIndex: 1,
  },
  orderQuantity: {
    flex: 1,
    fontSize: fontSize.base,
    textAlign: 'right',
    zIndex: 1,
  },
  currentPrice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginVertical: spacing.xs,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  currentPriceLabel: {
    fontSize: fontSize.sm,
  },
  currentPriceValue: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  loadingText: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  emptyText: {
    fontSize: fontSize.sm,
    fontStyle: 'italic',
    paddingVertical: spacing.xs,
  },
});

export default CompactOrderBook;