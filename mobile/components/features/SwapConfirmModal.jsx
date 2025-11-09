// mobile/components/features/SwapConfirmModal.jsx
import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../constants/theme';
import Card from '../ui/Card';
import Button from '../ui/Button';

export default function SwapConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  fromCrypto,
  toCrypto,
  fromAmount,
  toAmount,
  exchangeRate,
  isLoading = false,
}) {
  const { theme } = useTheme();

  // Render crypto icon con manejo de SVG y fallback
  const renderCryptoIcon = (crypto, size = 24) => {
    if (!crypto.iconUrl) {
      return (
        <View style={[
          styles.cryptoIconPlaceholder, 
          { backgroundColor: theme.backgroundElevated, width: size, height: size }
        ]}>
          <Text style={[styles.cryptoIconText, { color: theme.textPrimary }]}>
            {crypto.symbol.charAt(0)}
          </Text>
        </View>
      );
    }

    // Convertir SVG a PNG (mismo patrón que assets.js)
    const imageUri = crypto.iconUrl
      .replace('/svg/color/', '/32/color/')
      .replace('.svg', '.png');

    return (
      <Image
        source={{ uri: imageUri }}
        style={[styles.cryptoIcon, { width: size, height: size }]}
        resizeMode="contain"
        onError={() => {
          console.log(`Error cargando ícono de ${crypto.symbol}`);
        }}
      />
    );
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>
              Confirmar Intercambio
            </Text>
            <TouchableOpacity
              onPress={onClose}
              disabled={isLoading}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* From Section */}
            <Card style={styles.card}>
              <View style={styles.cryptoRow}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Envías
                </Text>
                <View style={styles.amountContainer}>
                  <Text style={[styles.amount, { color: theme.textPrimary }]}>
                    {parseFloat(fromAmount).toFixed(8)}
                  </Text>
                  <View style={styles.cryptoInfo}>
                    {renderCryptoIcon(fromCrypto, 24)}
                    <Text style={[styles.cryptoSymbol, { color: theme.textPrimary }]}>
                      {fromCrypto.symbol}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>

            {/* Arrow Icon */}
            <View style={styles.arrowContainer}>
              <Ionicons 
                name="arrow-down" 
                size={32} 
                color={theme.brandPrimary} 
              />
            </View>

            {/* To Section */}
            <Card style={styles.card}>
              <View style={styles.cryptoRow}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Recibes
                </Text>
                <View style={styles.amountContainer}>
                  <Text style={[styles.amount, { color: theme.success }]}>
                    {parseFloat(toAmount).toFixed(8)}
                  </Text>
                  <View style={styles.cryptoInfo}>
                    {renderCryptoIcon(toCrypto, 24)}
                    <Text style={[styles.cryptoSymbol, { color: theme.textPrimary }]}>
                      {toCrypto.symbol}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>

            {/* Exchange Rate */}
            <View style={[styles.rateContainer, { backgroundColor: theme.backgroundSecondary }]}>
              <Ionicons name="swap-horizontal" size={16} color={theme.textSecondary} />
              <Text style={[styles.rateText, { color: theme.textSecondary }]}>
                1 {fromCrypto.symbol} = {exchangeRate.toFixed(8)} {toCrypto.symbol}
              </Text>
            </View>

            {/* Info */}
            <View style={[styles.infoContainer, { backgroundColor: theme.infoBg }]}>
              <Ionicons name="information-circle" size={20} color={theme.brandPrimary} />
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                El intercambio se procesará de forma inmediata
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              variant="outline"
              onPress={onClose}
              disabled={isLoading}
              style={styles.actionButton}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onPress={onConfirm}
              loading={isLoading}
              disabled={isLoading}
              style={styles.actionButton}
            >
              {isLoading ? 'Procesando...' : 'Confirmar'}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: spacing.xs,
  },
  content: {
    marginBottom: spacing.lg,
  },
  card: {
    marginBottom: spacing.md,
  },
  cryptoRow: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  amountContainer: {
    gap: spacing.sm,
  },
  amount: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
  },
  cryptoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cryptoIcon: {
    borderRadius: borderRadius.full,
  },
  cryptoIconPlaceholder: {
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cryptoIconText: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
  },
  cryptoSymbol: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  arrowContainer: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  rateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  rateText: {
    fontSize: fontSize.sm,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  infoText: {
    fontSize: fontSize.sm,
    flex: 1,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
});