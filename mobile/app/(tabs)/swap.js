// mobile/app/(tabs)/swap.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize, borderRadius, shadows } from '../../constants/theme';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import useSwap from '../../hooks/useSwap';
import SwapConfirmModal from '../../components/features/SwapConfirmModal';

export default function Swap() {
  const { theme } = useTheme();

  // Animación para skeleton
  const skeletonOpacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonOpacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(skeletonOpacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    return () => pulseAnimation.stop();
  }, []);

  // Hook con todas las funcionalidades de swap
  const {
    fromCrypto,
    toCrypto,
    fromAmount,
    toAmount,
    exchangeRate,
    isLoading,
    priceLoading,
    isExecuting,
    getBalance,
    getAvailableFromCryptos,
    getAvailableToCryptos,
    handleFromCryptoChange,
    handleToCryptoChange,
    handleFromAmountChange,
    handleSwapCryptos,
    handleUseMaxBalance,
    executeSwap,
    hasInsufficientBalance,
    isSameCurrency,
    isPairValid,
  } = useSwap();

  // Estados locales de la UI
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);

  // Cerrar dropdowns al tocar fuera
  useEffect(() => {
    if (showFromDropdown || showToDropdown) {
      // Auto-cerrar después de un tiempo para mejor UX
      const timer = setTimeout(() => {
        setShowFromDropdown(false);
        setShowToDropdown(false);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [showFromDropdown, showToDropdown]);

  // Handlers
  const handleConfirm = () => {
    if (
      !fromAmount ||
      !fromCrypto ||
      !toCrypto ||
      hasInsufficientBalance ||
      isSameCurrency ||
      !isPairValid
    )
      return;

    setShowConfirmModal(true);
  };

  const handleExecuteSwap = () => {
    console.log('[Swap] Executing swap');
    executeSwap();
    setShowConfirmModal(false);
  };

  // Render crypto icon con manejo de SVG y fallback
  const renderCryptoIcon = (crypto, size = 28) => {
    // Si no hay iconUrl, mostrar placeholder
    if (!crypto.iconUrl) {
      return (
        <View style={[
          styles.cryptoIconPlaceholder, 
          { backgroundColor: theme.backgroundSecondary, width: size, height: size }
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

  // Skeleton para botón selector de crypto
  const renderCryptoButtonSkeleton = () => (
    <View style={[styles.cryptoButton, { backgroundColor: theme.backgroundElevated }]}>
      <View style={styles.cryptoButtonContent}>
        <Animated.View style={[
          styles.skeleton, 
          styles.skeletonIcon,
          { backgroundColor: theme.backgroundSecondary, opacity: skeletonOpacity }
        ]} />
        <Animated.View style={[
          styles.skeleton, 
          styles.skeletonText,
          { backgroundColor: theme.backgroundSecondary, opacity: skeletonOpacity }
        ]} />
      </View>
      <Ionicons name="chevron-down" size={20} color={theme.textMuted} />
    </View>
  );

  // Skeleton para items del dropdown
  const renderDropdownSkeleton = () => (
    <Card style={[styles.dropdown, { opacity: 1 }]}>
      <View style={styles.dropdownScroll}>
        {[1, 2, 3, 4, 5].map((index) => (
          <View
            key={index}
            style={[styles.dropdownItem, { borderBottomColor: theme.border }]}
          >
            <Animated.View style={[
              styles.skeleton,
              styles.skeletonIcon,
              { backgroundColor: theme.backgroundSecondary, opacity: skeletonOpacity }
            ]} />
            <View style={styles.dropdownItemInfo}>
              <Animated.View style={[
                styles.skeleton,
                styles.skeletonText,
                { backgroundColor: theme.backgroundSecondary, opacity: skeletonOpacity, marginBottom: 6 }
              ]} />
              <Animated.View style={[
                styles.skeleton,
                styles.skeletonTextSmall,
                { backgroundColor: theme.backgroundSecondary, opacity: skeletonOpacity }
              ]} />
            </View>
          </View>
        ))}
      </View>
    </Card>
  );

  // Render crypto selector button
  const renderCryptoButton = (crypto, isFrom, showDropdown, setShowDropdown) => (
    <TouchableOpacity
      style={[styles.cryptoButton, { backgroundColor: theme.backgroundElevated }]}
      onPress={() => {
        if (isFrom) {
          setShowFromDropdown(!showDropdown);
          setShowToDropdown(false);
        } else {
          setShowToDropdown(!showDropdown);
          setShowFromDropdown(false);
        }
      }}
      disabled={isLoading || priceLoading}
    >
      {crypto ? (
        <View style={styles.cryptoButtonContent}>
          {renderCryptoIcon(crypto, 28)}
          <Text style={[styles.cryptoSymbol, { color: theme.textPrimary }]}>
            {crypto.symbol}
          </Text>
        </View>
      ) : (
        <Text style={[styles.cryptoSymbol, { color: theme.textMuted }]}>
          Seleccionar
        </Text>
      )}
      <Ionicons 
        name={showDropdown ? "chevron-up" : "chevron-down"} 
        size={20} 
        color={theme.textSecondary} 
      />
    </TouchableOpacity>
  );

  // Render crypto dropdown
  const renderCryptoDropdown = (cryptos, onSelect, setShowDropdown) => (
    <Card style={[styles.dropdown, shadows.lg]}>
      <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
        {cryptos.length > 0 ? (
          cryptos.map((crypto) => (
            <TouchableOpacity
              key={crypto.id}
              style={[styles.dropdownItem, { borderBottomColor: theme.border }]}
              onPress={() => {
                onSelect(crypto);
                setShowDropdown(false);
              }}
            >
              {renderCryptoIcon(crypto, 32)}
              <View style={styles.dropdownItemInfo}>
                <Text style={[styles.dropdownItemSymbol, { color: theme.textPrimary }]}>
                  {crypto.symbol}
                </Text>
                <Text style={[styles.dropdownItemName, { color: theme.textSecondary }]}>
                  {crypto.nombre}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={[styles.noOptions, { color: theme.textMuted }]}>
            No hay criptomonedas disponibles
          </Text>
        )}
      </ScrollView>
    </Card>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            Intercambiar Criptomonedas
          </Text>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* From Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                De
              </Text>
              <Text style={[styles.balanceText, { color: theme.textSecondary }]}>
                Saldo: {fromCrypto ? getBalance(fromCrypto.symbol).toFixed(8) : '0.00000000'}{' '}
                {fromCrypto?.symbol || ''}
              </Text>
            </View>

            <Card style={styles.card}>
              {/* Selector y Input en una sola fila horizontal */}
              <View style={styles.mainInputRow}>
                {/* Selector de criptomoneda */}
                {isLoading ? (
                  renderCryptoButtonSkeleton()
                ) : (
                  renderCryptoButton(fromCrypto, true, showFromDropdown, setShowFromDropdown)
                )}
                
                {/* Input de cantidad */}
                <View style={styles.inputWrapper}>
                  <Input
                    value={fromAmount}
                    onChangeText={handleFromAmountChange}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    editable={!isLoading && !priceLoading}
                    style={styles.amountInput}
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
              </View>

              {/* Dropdown de criptomonedas origen */}
              {showFromDropdown && (
                isLoading ? (
                  renderDropdownSkeleton()
                ) : (
                  renderCryptoDropdown(
                    getAvailableFromCryptos(),
                    handleFromCryptoChange,
                    setShowFromDropdown
                  )
                )
              )}
            </Card>

            {/* Error de balance insuficiente */}
            {hasInsufficientBalance && (
              <View style={[styles.errorContainer, { backgroundColor: theme.errorBg }]}>
                <Ionicons name="alert-circle" size={16} color={theme.error} />
                <Text style={[styles.errorText, { color: theme.error }]}>
                  Balance insuficiente. Disponible: {getBalance(fromCrypto.symbol).toFixed(8)}{' '}
                  {fromCrypto.symbol}
                </Text>
              </View>
            )}
          </View>

          {/* Swap Button */}
          <View style={styles.swapButtonContainer}>
            <TouchableOpacity
              style={[styles.swapButton, { backgroundColor: theme.brandPrimary }]}
              onPress={handleSwapCryptos}
              disabled={isLoading || priceLoading}
            >
              <Ionicons name="swap-vertical" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* To Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                A
              </Text>
              <Text style={[styles.balanceText, { color: theme.textSecondary }]}>
                Saldo: {toCrypto ? getBalance(toCrypto.symbol).toFixed(8) : '0.00000000'}{' '}
                {toCrypto?.symbol || ''}
              </Text>
            </View>

            <Card style={styles.card}>
              {/* Selector y Output en una sola fila horizontal */}
              <View style={styles.mainInputRow}>
                {/* Selector de criptomoneda */}
                {isLoading ? (
                  renderCryptoButtonSkeleton()
                ) : (
                  renderCryptoButton(toCrypto, false, showToDropdown, setShowToDropdown)
                )}
                
                {/* Output de cantidad */}
                <View style={styles.outputWrapper}>
                  {priceLoading && fromAmount ? (
                    <View style={styles.calculatingContainer}>
                      <ActivityIndicator size="small" color={theme.brandPrimary} />
                      <Text style={[styles.calculatingText, { color: theme.textMuted }]}>
                        Calculando...
                      </Text>
                    </View>
                  ) : (
                    <Text 
                      style={[styles.outputAmount, { color: theme.textPrimary }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {toAmount || '0.00'}
                    </Text>
                  )}
                </View>
              </View>

              {/* Dropdown de criptomonedas destino */}
              {showToDropdown && (
                isLoading ? (
                  renderDropdownSkeleton()
                ) : (
                  renderCryptoDropdown(
                    getAvailableToCryptos(),
                    handleToCryptoChange,
                    setShowToDropdown
                  )
                )
              )}
            </Card>
          </View>

          {/* Exchange Rate */}
          {exchangeRate && fromCrypto && toCrypto && !isSameCurrency && isPairValid && (
            <View style={[styles.rateContainer, { backgroundColor: theme.backgroundSecondary }]}>
              <Ionicons name="swap-horizontal" size={16} color={theme.textSecondary} />
              <Text style={[styles.rateText, { color: theme.textSecondary }]}>
                1 {fromCrypto.symbol} = {exchangeRate.toFixed(8)} {toCrypto.symbol}
              </Text>
            </View>
          )}

          {/* Warnings */}
          {isSameCurrency && (
            <View style={[styles.warningContainer, { backgroundColor: theme.warningBg }]}>
              <Ionicons name="warning" size={20} color={theme.warning} />
              <Text style={[styles.warningText, { color: theme.warning }]}>
                No puedes intercambiar la misma criptomoneda
              </Text>
            </View>
          )}

          {!isSameCurrency && fromCrypto && toCrypto && !isPairValid && (
            <View style={[styles.errorContainer, { backgroundColor: theme.errorBg }]}>
              <Ionicons name="close-circle" size={20} color={theme.error} />
              <Text style={[styles.errorText, { color: theme.error }]}>
                El par {fromCrypto.symbol}/{toCrypto.symbol} no está disponible para intercambio
              </Text>
            </View>
          )}

          {/* Confirm Button */}
          <Button
            variant="primary"
            onPress={handleConfirm}
            disabled={
              !fromAmount ||
              !fromCrypto ||
              !toCrypto ||
              hasInsufficientBalance ||
              isSameCurrency ||
              !isPairValid ||
              isLoading ||
              priceLoading ||
              isExecuting
            }
            loading={isExecuting}
            style={styles.confirmButton}
          >
            {isExecuting
              ? 'Procesando...'
              : priceLoading
              ? 'Cargando...'
              : isSameCurrency
              ? 'Selecciona monedas diferentes'
              : !isPairValid && fromCrypto && toCrypto
              ? 'Par no disponible'
              : hasInsufficientBalance
              ? 'Balance insuficiente'
              : 'Vista previa'}
          </Button>
        </View>
      </ScrollView>

      {/* Modal de confirmación */}
      {showConfirmModal && fromCrypto && toCrypto && fromAmount && toAmount && exchangeRate && (
        <SwapConfirmModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleExecuteSwap}
          fromCrypto={fromCrypto}
          toCrypto={toCrypto}
          fromAmount={fromAmount}
          toAmount={toAmount}
          exchangeRate={exchangeRate}
          isLoading={isExecuting}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: 'bold',
  },
  content: {
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  sectionLabel: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  balanceText: {
    fontSize: fontSize.xs,
  },
  card: {
    padding: spacing.md,
  },
  mainInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cryptoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    minWidth: 120,
  },
  cryptoButtonContent: {
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
  inputWrapper: {
    flex: 1,
  },
  amountInput: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    textAlign: 'right',
    padding: 0,
    margin: 0,
  },
  outputWrapper: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  outputAmount: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  maxButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  maxButtonText: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  calculatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  calculatingText: {
    fontSize: fontSize.base,
  },
  dropdown: {
    maxHeight: 300,
    marginTop: spacing.md,
  },
  dropdownScroll: {
    maxHeight: 300,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
  },
  dropdownItemInfo: {
    flex: 1,
  },
  dropdownItemSymbol: {
    fontSize: fontSize.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  dropdownItemName: {
    fontSize: fontSize.xs,
  },
  noOptions: {
    padding: spacing.lg,
    textAlign: 'center',
    fontSize: fontSize.sm,
  },
  swapButtonContainer: {
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  swapButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  rateText: {
    fontSize: fontSize.sm,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  warningText: {
    fontSize: fontSize.sm,
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  errorText: {
    fontSize: fontSize.sm,
    flex: 1,
  },
  confirmButton: {
    marginTop: spacing.md,
  },

  // Skeleton Loaders
  skeleton: {
    borderRadius: borderRadius.sm,
  },
  skeletonIcon: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
  },
  skeletonText: {
    height: 16,
    width: 60,
  },
  skeletonTextSmall: {
    height: 14,
    width: 100,
  },
});