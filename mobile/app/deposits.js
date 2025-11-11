// app/(tabs)/deposits.js
import React, { useState, useEffect } from "react"
import {
  View,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
  Image,
  TouchableOpacity,
  StyleSheet,
  Text,
} from "react-native"
import * as Clipboard from 'expo-clipboard'
import QRCode from "react-native-qrcode-svg"
import { useTheme } from '../contexts/ThemeContext'
import { spacing, fontSize, borderRadius } from '../constants/theme'
import { useCryptos } from "../hooks/useCryptos"
import Card from "../components/ui/Card"
import Button from "../components/ui/Button"
import { SafeAreaView } from 'react-native-safe-area-context';
import Screen from '../components/common/Screen';

const { width } = Dimensions.get("window")
const QR_SIZE = Math.min(width * 0.4, 180) // ✅ Aumentado de 140 a 180
const CARD_SPACING = spacing.sm
const CRYPTO_ICON_SIZE = 28
const CRYPTO_ITEM_WIDTH = 80

export default function DepositsScreen() {
  const { theme } = useTheme()
  const { cryptos, isLoading, error, refetch } = useCryptos()
  const [selectedCrypto, setSelectedCrypto] = useState(null)
  const [imageErrors, setImageErrors] = useState({})

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      marginTop: spacing.md,
      fontSize: fontSize.md,
    },
    errorContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: spacing.md,
    },
    errorText: {
      marginBottom: spacing.sm,
      textAlign: 'center',
      fontSize: fontSize.md,
    },
    scrollContent: {
      paddingBottom: spacing.xl,
    },
    header: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    title: {
      fontSize: fontSize.xxxl,
      fontWeight: "700",
      marginBottom: spacing.xs,
    },
    subtitle: {
      fontSize: fontSize.sm,
      fontWeight: "400",
    },
    selectorContainer: {
      marginBottom: spacing.lg,
    },
    selectorScrollContent: {
      paddingHorizontal: spacing.lg,
      gap: CARD_SPACING,
    },
    cryptoItem: {
      width: CRYPTO_ITEM_WIDTH,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    cryptoIconContainer: {
      marginBottom: spacing.xs,
      alignItems: 'center',
      justifyContent: 'center',
      width: CRYPTO_ICON_SIZE,
      height: CRYPTO_ICON_SIZE,
    },
    cryptoIcon: {
      width: CRYPTO_ICON_SIZE,
      height: CRYPTO_ICON_SIZE,
      borderRadius: borderRadius.full,
    },
    cryptoIconPlaceholder: {
      width: CRYPTO_ICON_SIZE,
      height: CRYPTO_ICON_SIZE,
      borderRadius: borderRadius.full,
      backgroundColor: theme.textMuted,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    cryptoIconText: {
      fontSize: 9,
      fontWeight: '700',
      color: theme.textInverse,
      textAlign: 'center',
      includeFontPadding: false,
      textAlignVertical: 'center',
      paddingHorizontal: 1,
    },
    cryptoSymbol: {
      fontSize: fontSize.xs,
      fontWeight: "600",
      marginBottom: 1,
      textAlign: 'center',
    },
    cryptoName: {
      fontSize: 10,
      textAlign: 'center',
      maxWidth: '100%',
    },
    infoCard: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    infoLabel: {
      fontSize: fontSize.sm,
      fontWeight: "500",
      marginBottom: spacing.md,
    },
    // ✅ CONTENEDOR UNIFICADO - SIN FONDO SEPARADO
    qrContainer: {
      alignItems: "center",
      marginBottom: spacing.lg,
      paddingVertical: spacing.lg, // ✅ Aumentado padding para más espacio
    },
    qrPlaceholder: {
      width: QR_SIZE,
      height: QR_SIZE,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.border,
      borderRadius: borderRadius.md,
    },
    placeholderText: {
      fontSize: fontSize.xs,
      textAlign: 'center',
      paddingHorizontal: spacing.sm,
    },
    addressContainer: {
      marginBottom: spacing.md,
    },
    addressLabel: {
      fontSize: fontSize.xs,
      fontWeight: "500",
      marginBottom: spacing.xs,
    },
    addressText: {
      fontSize: fontSize.xs,
      fontFamily: "monospace",
      lineHeight: 18,
    },
    buttonContainer: {
      paddingHorizontal: spacing.lg,
    },
  })

  // Establecer la primera crypto al cargar
  useEffect(() => {
    if (cryptos && cryptos.length > 0 && !selectedCrypto) {
      const cryptoWithAddress = cryptos.find(crypto => 
        crypto.direccionContrato && crypto.direccionContrato.trim() !== ''
      ) || cryptos[0];
      
      setSelectedCrypto(cryptoWithAddress);
    }
  }, [cryptos, selectedCrypto]);

  const handleImageError = (cryptoId) => {
    setImageErrors(prev => ({
      ...prev,
      [cryptoId]: true
    }));
  };

  const handleCopyAddress = async () => {
    if (!selectedCrypto?.direccionContrato) {
      Alert.alert("Error", "No hay dirección disponible para copiar")
      return
    }

    await Clipboard.setStringAsync(selectedCrypto.direccionContrato)
    Alert.alert("Éxito", "Dirección copiada al portapapeles")
  }

  const handleRetry = () => {
    refetch?.()
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.brandPrimary} />
        <Text style={[styles.loadingText, { color: theme.textPrimary }]}>
          Cargando criptomonedas...
        </Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.error }]}>
          Error al cargar depósitos: {error.message || 'Error desconocido'}
        </Text>
        <Button variant="primary" onPress={handleRetry}>
          Reintentar
        </Button>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            Depósitos
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Deposita cripto de forma segura
          </Text>
        </View>

        {/* Selector de Moneda */}
        <View style={styles.selectorContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.selectorScrollContent}
          >
            {cryptos && cryptos.map((crypto) => {
              const showPlaceholder = !crypto.symbol || imageErrors[crypto.id];
              
              return (
                <TouchableOpacity
                  key={crypto.id}
                  onPress={() => setSelectedCrypto(crypto)}
                  style={[
                    styles.cryptoItem,
                    { 
                      backgroundColor: selectedCrypto?.id === crypto.id ? 
                        theme.brandPrimary : theme.backgroundCard,
                      borderColor: selectedCrypto?.id === crypto.id ? 
                        theme.brandPrimary : theme.border,
                    }
                  ]}
                >
                  <View style={styles.cryptoIconContainer}>
                    {!showPlaceholder ? (
                      <Image
                        source={{ 
                          uri: `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/${crypto.symbol.toLowerCase()}.png`
                        }}
                        style={styles.cryptoIcon}
                        resizeMode="contain"
                        onError={() => handleImageError(crypto.id)}
                      />
                    ) : (
                      <View style={styles.cryptoIconPlaceholder}>
                        <Text style={styles.cryptoIconText} numberOfLines={1}>
                          {crypto.symbol ? 
                            (crypto.symbol.length > 4 ? 
                              `${crypto.symbol.substring(0, 4)}` : crypto.symbol
                            ) : '?'
                          }
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  <Text style={[
                    styles.cryptoSymbol,
                    { 
                      color: selectedCrypto?.id === crypto.id ? 
                        theme.textInverse : theme.textPrimary 
                    }
                  ]}>
                    {crypto.symbol}
                  </Text>
                  <Text 
                    style={[
                      styles.cryptoName,
                      { 
                        color: selectedCrypto?.id === crypto.id ? 
                          theme.textInverse : theme.textSecondary 
                      }
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {crypto.nombre}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ✅ INFORMACIÓN DE DEPÓSITO CON QR INTEGRADO */}
        {selectedCrypto && (
          <Card style={styles.infoCard}>
            <View>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                Red: <Text style={{ color: theme.textPrimary }}>{selectedCrypto.red}</Text>
              </Text>

              {/* ✅ QR CODE INTEGRADO - SIN FONDO SEPARADO */}
              <View style={styles.qrContainer}>
                {selectedCrypto.direccionContrato ? (
                  <QRCode
                    value={selectedCrypto.direccionContrato}
                    size={QR_SIZE} // ✅ QR más grande
                    color={theme.textPrimary}
                    backgroundColor="transparent" // ✅ Fondo transparente para integrarse
                  />
                ) : (
                  <View style={[styles.qrPlaceholder, { borderColor: theme.border }]}>
                    <Text style={[styles.placeholderText, { color: theme.textSecondary }]}>
                      QR no disponible
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.addressContainer}>
                <Text style={[styles.addressLabel, { color: theme.textSecondary }]}>
                  Dirección
                </Text>
                <Text style={[styles.addressText, { color: theme.textPrimary }]}>
                  {selectedCrypto.direccionContrato}
                </Text>
              </View>

              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                Decimales: <Text style={{ color: theme.textPrimary }}>{selectedCrypto.decimales}</Text>
              </Text>

              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                Creado: <Text style={{ color: theme.textPrimary }}>{formatDate(selectedCrypto.created_at)}</Text>
              </Text>
            </View>
          </Card>
        )}

        <View style={styles.buttonContainer}>
          <Button 
            variant="primary" 
            onPress={handleCopyAddress} 
            disabled={!selectedCrypto?.direccionContrato}
          >
            {selectedCrypto?.direccionContrato ? "Copiar dirección" : "Dirección no disponible"}
          </Button>
        </View>
      </ScrollView>
      </SafeAreaView>
    </View>
  )
}