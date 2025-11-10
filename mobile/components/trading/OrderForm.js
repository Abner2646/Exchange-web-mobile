// mobile/components/trading/OrderForm.js
import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../constants/theme';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Button from '../ui/Button';

const OrderForm = ({ pair, balance, onSubmit, loading }) => {
  const { theme } = useTheme();
  
  const [side, setSide] = useState('buy');
  const [orderType, setOrderType] = useState('limit');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [percentage, setPercentage] = useState(null);
  const [errors, setErrors] = useState({});

  // Obtener balance disponible según el lado de la orden
  const availableBalance = useMemo(() => {
    if (!balance || !pair) return 0;

    if (side === 'buy') {
      const quoteBalance = balance.find(b => 
        b.criptomonedaId === pair.quoteAssetId
      );
      return parseFloat(quoteBalance?.available || 0);
    } else {
      const baseBalance = balance.find(b => 
        b.criptomonedaId === pair.baseAssetId
      );
      return parseFloat(baseBalance?.available || 0);
    }
  }, [balance, pair, side]);

  // Calcular total
  const total = useMemo(() => {
    const qty = parseFloat(quantity) || 0;
    const prc = orderType === 'market' 
      ? parseFloat(pair?.lastPrice || 0) 
      : parseFloat(price) || 0;
    return qty * prc;
  }, [quantity, price, orderType, pair]);

  // Setear precio cuando cambia el par o el tipo de orden
  useEffect(() => {
    if (orderType === 'market' && pair) {
      setPrice(pair.lastPrice);
    }
  }, [orderType, pair]);

  // Validar formulario
  const validate = () => {
    const newErrors = {};

    if (!quantity || parseFloat(quantity) <= 0) {
      newErrors.quantity = 'La cantidad debe ser mayor a 0';
    }

    if (pair) {
      const qty = parseFloat(quantity) || 0;
      if (qty < parseFloat(pair.minOrderAmount)) {
        newErrors.quantity = `Cantidad mínima: ${pair.minOrderAmount}`;
      }
      if (qty > parseFloat(pair.maxOrderAmount)) {
        newErrors.quantity = `Cantidad máxima: ${pair.maxOrderAmount}`;
      }
    }

    if (orderType === 'limit') {
      if (!price || parseFloat(price) <= 0) {
        newErrors.price = 'El precio debe ser mayor a 0';
      }
    }

    if (side === 'buy' && total > availableBalance) {
      newErrors.balance = 'Balance insuficiente';
    }

    if (side === 'sell' && parseFloat(quantity) > availableBalance) {
      newErrors.balance = 'Balance insuficiente';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Manejar submit
  const handleSubmit = () => {
    if (!validate()) {
      Alert.alert('Error', Object.values(errors)[0]);
      return;
    }

    const orderData = {
      side,
      orderType,
      quantity: parseFloat(quantity),
      price: orderType === 'limit' ? parseFloat(price) : null,
      timeInForce: 'GTC',
    };

    onSubmit(orderData);
  };

  // Setear cantidad por porcentaje
  const handlePercentageClick = (percent) => {
    setPercentage(percent);
    
    if (side === 'buy') {
      const available = availableBalance * (percent / 100);
      const currentPrice = orderType === 'market' 
        ? parseFloat(pair?.lastPrice || 0) 
        : parseFloat(price) || 0;
      if (currentPrice > 0) {
        const qty = available / currentPrice;
        setQuantity(qty.toFixed(pair?.quantityPrecision || 4));
      }
    } else {
      const qty = availableBalance * (percent / 100);
      setQuantity(qty.toFixed(pair?.quantityPrecision || 4));
    }
  };

  return (
    <Card style={styles.container}>
      {/* Side selector */}
      <View style={styles.sideSelector}>
        <TouchableOpacity
          style={[
            styles.sideBtn,
            side === 'buy' && { backgroundColor: theme.buy },
          ]}
          onPress={() => setSide('buy')}
        >
          <Text 
            style={[
              styles.sideBtnText,
              { color: side === 'buy' ? '#ffffff' : theme.textPrimary }
            ]}
          >
            Comprar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.sideBtn,
            side === 'sell' && { backgroundColor: theme.sell },
          ]}
          onPress={() => setSide('sell')}
        >
          <Text 
            style={[
              styles.sideBtnText,
              { color: side === 'sell' ? '#ffffff' : theme.textPrimary }
            ]}
          >
            Vender
          </Text>
        </TouchableOpacity>
      </View>

      {/* Order type selector */}
      <View style={styles.typeSelector}>
        <TouchableOpacity
          style={[
            styles.typeBtn,
            orderType === 'limit' && [
              styles.typeBtnActive,
              { borderColor: theme.brandPrimary }
            ],
          ]}
          onPress={() => setOrderType('limit')}
        >
          <Text 
            style={[
              styles.typeBtnText,
              { color: orderType === 'limit' ? theme.brandPrimary : theme.textSecondary }
            ]}
          >
            Limit
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.typeBtn,
            orderType === 'market' && [
              styles.typeBtnActive,
              { borderColor: theme.brandPrimary }
            ],
          ]}
          onPress={() => setOrderType('market')}
        >
          <Text 
            style={[
              styles.typeBtnText,
              { color: orderType === 'market' ? theme.brandPrimary : theme.textSecondary }
            ]}
          >
            Market
          </Text>
        </TouchableOpacity>
      </View>

      {/* Available balance */}
      <View style={styles.balanceRow}>
        <Text style={[styles.balanceLabel, { color: theme.textSecondary }]}>
          Disponible:
        </Text>
        <Text style={[styles.balanceValue, { color: theme.textPrimary }]}>
          {availableBalance.toFixed(pair?.quantityPrecision || 4)} {' '}
          {side === 'buy' ? pair?.quoteAsset?.symbol : pair?.baseAsset?.symbol}
        </Text>
      </View>

      {/* Price input (solo para limit) */}
      {orderType === 'limit' && (
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
            Precio
          </Text>
          <View style={styles.inputWrapper}>
            <Input
              value={price}
              onChangeText={setPrice}
              placeholder="0.00"
              keyboardType="decimal-pad"
              editable={!loading}
              style={errors.price && styles.inputError}
            />
            <Text style={[styles.inputSuffix, { color: theme.textMuted }]}>
              {pair?.quoteAsset?.symbol}
            </Text>
          </View>
        </View>
      )}

      {/* Quantity input */}
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
          Cantidad
        </Text>
        <View style={styles.inputWrapper}>
          <Input
            value={quantity}
            onChangeText={(text) => {
              setQuantity(text);
              setPercentage(null);
            }}
            placeholder="0.00"
            keyboardType="decimal-pad"
            editable={!loading}
            style={errors.quantity && styles.inputError}
          />
          <Text style={[styles.inputSuffix, { color: theme.textMuted }]}>
            {pair?.baseAsset?.symbol}
          </Text>
        </View>
      </View>

      {/* Percentage buttons */}
      <View style={styles.percentageRow}>
        {[25, 50, 75, 100].map(percent => (
          <TouchableOpacity
            key={percent}
            style={[
              styles.percentageBtn,
              {
                backgroundColor: percentage === percent 
                  ? theme.brandPrimary 
                  : theme.backgroundSecondary,
              },
            ]}
            onPress={() => handlePercentageClick(percent)}
            disabled={loading}
          >
            <Text 
              style={[
                styles.percentageBtnText,
                { color: percentage === percent ? '#ffffff' : theme.textPrimary }
              ]}
            >
              {percent}%
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Total */}
      <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
        <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>
          Total:
        </Text>
        <Text style={[styles.totalValue, { color: theme.textPrimary }]}>
          {total.toFixed(pair?.pricePrecision || 2)} {pair?.quoteAsset?.symbol}
        </Text>
      </View>

      {/* Balance error */}
      {errors.balance && (
        <View style={[styles.errorBanner, { backgroundColor: `${theme.error}20` }]}>
          <Text style={[styles.errorText, { color: theme.error }]}>
            {errors.balance}
          </Text>
        </View>
      )}

      {/* Submit button */}
      <Button
        variant={side === 'buy' ? 'success' : 'danger'}
        onPress={handleSubmit}
        loading={loading}
        disabled={loading}
        style={styles.submitBtn}
      >
        {side === 'buy' ? 'Comprar' : 'Vender'} {pair?.baseAsset?.symbol}
      </Button>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  sideSelector: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sideBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  sideBtnText: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeBtnActive: {
    borderWidth: 1,
  },
  typeBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  balanceLabel: {
    fontSize: fontSize.sm,
  },
  balanceValue: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    position: 'relative',
  },
  inputSuffix: {
    position: 'absolute',
    right: spacing.md,
    top: '50%',
    transform: [{ translateY: -8 }],
    fontSize: fontSize.sm,
  },
  inputError: {
    borderColor: 'red',
  },
  percentageRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  percentageBtn: {
    flex: 1,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  percentageBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    marginBottom: spacing.md,
    borderTopWidth: 1,
  },
  totalLabel: {
    fontSize: fontSize.base,
  },
  totalValue: {
    fontSize: fontSize.base,
    fontWeight: '700',
  },
  errorBanner: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  submitBtn: {
    width: '100%',
  },
});

export default OrderForm;