// mobile/components/trading/OrdersList.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../constants/theme';
import Card from '../ui/Card';
import Button from '../ui/Button';

const OrdersList = ({ orders, onCancel, loading }) => {
  const { theme } = useTheme();
  const [filter, setFilter] = useState('open');
  const [cancellingOrderId, setCancellingOrderId] = useState(null);

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    if (filter === 'open') return order.status === 'open' || order.status === 'partially_filled';
    return order.status === filter;
  });

  const handleCancel = async (orderId) => {
    Alert.alert(
      'Cancelar Orden',
      '¿Estás seguro de que deseas cancelar esta orden?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setCancellingOrderId(orderId);
            await onCancel(orderId);
            setCancellingOrderId(null);
          }
        }
      ]
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (price, precision = 2) => {
    return parseFloat(price).toFixed(precision);
  };

  const formatQuantity = (quantity, precision = 4) => {
    return parseFloat(quantity).toFixed(precision);
  };

  const getStatusInfo = (status) => {
    const statusMap = {
      pending: { label: 'Pendiente', color: theme.warning },
      open: { label: 'Abierta', color: theme.brandPrimary },
      partially_filled: { label: 'Parcial', color: theme.info },
      filled: { label: 'Ejecutada', color: theme.success },
      cancelled: { label: 'Cancelada', color: theme.textMuted },
      expired: { label: 'Expirada', color: theme.textMuted },
      rejected: { label: 'Rechazada', color: theme.error },
    };

    return statusMap[status] || { label: status, color: theme.textMuted };
  };

  const renderOrder = ({ item: order }) => {
    const statusInfo = getStatusInfo(order.status);
    const canCancel = order.status === 'open' || order.status === 'partially_filled';
    const isCancelling = cancellingOrderId === order.id;
    const filledPercentage = (parseFloat(order.quantityFilled) / parseFloat(order.quantity)) * 100;

    return (
      <Card style={styles.orderCard}>
        {/* Header */}
        <View style={styles.orderHeader}>
          <View style={styles.orderTitleRow}>
            <Text style={[styles.orderPair, { color: theme.textPrimary }]}>
              {order.tradingPair?.symbol}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: `${statusInfo.color}20` }]}>
              <Text style={[styles.statusText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
          </View>
          <Text style={[styles.orderDate, { color: theme.textMuted }]}>
            {formatDate(order.createdAt)}
          </Text>
        </View>

        {/* Body */}
        <View style={styles.orderBody}>
          <View style={styles.orderRow}>
            <Text style={[styles.orderLabel, { color: theme.textSecondary }]}>
              Tipo:
            </Text>
            <View style={styles.orderValueContainer}>
              <Text 
                style={[
                  styles.orderSide,
                  { color: order.side === 'buy' ? theme.buy : theme.sell }
                ]}
              >
                {order.side === 'buy' ? 'Compra' : 'Venta'}
              </Text>
              <Text style={[styles.orderType, { color: theme.textSecondary }]}>
                {' '}• {order.orderType}
              </Text>
            </View>
          </View>

          <View style={styles.orderRow}>
            <Text style={[styles.orderLabel, { color: theme.textSecondary }]}>
              Precio:
            </Text>
            <Text style={[styles.orderValue, { color: theme.textPrimary }]}>
              {order.price ? formatPrice(order.price, order.tradingPair?.pricePrecision) : 'Market'}
            </Text>
          </View>

          <View style={styles.orderRow}>
            <Text style={[styles.orderLabel, { color: theme.textSecondary }]}>
              Cantidad:
            </Text>
            <Text style={[styles.orderValue, { color: theme.textPrimary }]}>
              {formatQuantity(order.quantity, order.tradingPair?.quantityPrecision)}
            </Text>
          </View>

          <View style={styles.orderRow}>
            <Text style={[styles.orderLabel, { color: theme.textSecondary }]}>
              Ejecutado:
            </Text>
            <View style={styles.executedContainer}>
              <Text style={[styles.orderValue, { color: theme.textPrimary }]}>
                {formatQuantity(order.quantityFilled, order.tradingPair?.quantityPrecision)}
              </Text>
              <Text style={[styles.percentage, { color: theme.textMuted }]}>
                {' '}({filledPercentage.toFixed(0)}%)
              </Text>
            </View>
          </View>
        </View>

        {/* Action */}
        {canCancel && (
          <Button
            variant="danger"
            onPress={() => handleCancel(order.id)}
            disabled={isCancelling}
            loading={isCancelling}
            style={styles.cancelBtn}
          >
            Cancelar Orden
          </Button>
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.brandPrimary} />
        <Text style={[styles.loadingText, { color: theme.textMuted }]}>
          Cargando órdenes...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filters */}
      <View style={styles.filtersRow}>
        {[
          { key: 'open', label: 'Abiertas' },
          { key: 'filled', label: 'Ejecutadas' },
          { key: 'cancelled', label: 'Canceladas' },
          { key: 'all', label: 'Todas' },
        ].map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.filterBtn,
              filter === key && [
                styles.filterBtnActive,
                { backgroundColor: theme.brandPrimary }
              ],
            ]}
            onPress={() => setFilter(key)}
          >
            <Text 
              style={[
                styles.filterBtnText,
                { color: filter === key ? '#ffffff' : theme.textSecondary }
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Orders list */}
      {filteredOrders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons 
            name="document-text-outline" 
            size={48} 
            color={theme.textMuted} 
          />
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            No tienes órdenes {filter !== 'all' && (filter === 'open' ? 'abiertas' : filter)}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          renderItem={renderOrder}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  filterBtnActive: {
    borderRadius: borderRadius.sm,
  },
  filterBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  listContent: {
    padding: spacing.md,
    paddingTop: spacing.sm,
  },
  orderCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  orderHeader: {
    marginBottom: spacing.sm,
  },
  orderTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  orderPair: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  orderDate: {
    fontSize: fontSize.sm,
  },
  orderBody: {
    marginBottom: spacing.sm,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  orderLabel: {
    fontSize: fontSize.base,
  },
  orderValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderValue: {
    fontSize: fontSize.base,
    fontWeight: '500',
  },
  orderSide: {
    fontSize: fontSize.base,
    fontWeight: '700',
  },
  orderType: {
    fontSize: fontSize.sm,
  },
  executedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  percentage: {
    fontSize: fontSize.sm,
  },
  cancelBtn: {
    marginTop: spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    fontSize: fontSize.base,
    marginTop: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.base,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});

export default OrdersList;