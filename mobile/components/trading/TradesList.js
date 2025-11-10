// mobile/components/trading/TradesList.js
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize } from '../../constants/theme';
import Card from '../ui/Card';

const TradesList = ({ trades, pair, loading }) => {
  const { theme } = useTheme();

  const safeTrades = useMemo(() => {
    return Array.isArray(trades) ? trades : [];
  }, [trades]);

  const formatPrice = (price, precision = 2) => {
    if (!price || isNaN(price)) return '0.00';
    return parseFloat(price).toFixed(precision);
  };

  const formatQuantity = (quantity, precision = 4) => {
    if (!quantity || isNaN(quantity)) return '0.0000';
    return parseFloat(quantity).toFixed(precision);
  };

  const formatTime = (dateString) => {
    if (!dateString) return '--:--';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '--:--';
      return date.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (error) {
      return '--:--';
    }
  };

  const renderTrade = ({ item: trade, index }) => {
    if (!trade || typeof trade !== 'object') return null;

    const isBuyerMaker = trade.makerSide === 'buy';
    const isBuy = !isBuyerMaker;

    return (
      <View style={styles.tradeRow}>
        <Text 
          style={[
            styles.price, 
            { color: isBuy ? theme.buy : theme.sell }
          ]}
        >
          {formatPrice(trade.price, pair?.pricePrecision)}
        </Text>
        <Text style={[styles.quantity, { color: theme.textSecondary }]}>
          {formatQuantity(trade.quantity, pair?.quantityPrecision)}
        </Text>
        <Text style={[styles.time, { color: theme.textMuted }]}>
          {formatTime(trade.createdAt)}
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
            Cargando trades...
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card style={styles.container}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>
        Trades Recientes
      </Text>
      
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.headerCell, { color: theme.textSecondary }]}>
          Precio
        </Text>
        <Text style={[styles.headerCell, { color: theme.textSecondary }]}>
          Cantidad
        </Text>
        <Text style={[styles.headerCell, { color: theme.textSecondary }]}>
          Hora
        </Text>
      </View>

      {safeTrades.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            No hay trades recientes
          </Text>
        </View>
      ) : (
        <FlatList
          data={safeTrades}
          renderItem={renderTrade}
          keyExtractor={(item, index) => item?.id?.toString() || `trade-${index}`}
          scrollEnabled={false}
          style={styles.list}
        />
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    marginBottom: spacing.xs,
  },
  headerCell: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  list: {
    maxHeight: 300,
  },
  tradeRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
  },
  price: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: '500',
  },
  quantity: {
    flex: 1,
    fontSize: fontSize.base,
  },
  time: {
    flex: 1,
    fontSize: fontSize.sm,
    textAlign: 'right',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  loadingText: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.base,
  },
});

export default TradesList;