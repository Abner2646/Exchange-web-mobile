// mobile/components/trading/TradingChartDebug.js
// ⚠️ VERSIÓN DE DEBUG - Usar temporalmente para ver qué está pasando

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize } from '../../constants/theme';

const TradingChartDebug = ({ data, pair, selectedInterval, loading }) => {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundSecondary }]}>
      <ScrollView style={styles.scroll}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          🔍 DEBUG: Datos del Gráfico
        </Text>

        {/* Loading */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Loading:
          </Text>
          <Text style={[styles.value, { color: theme.textPrimary }]}>
            {loading ? 'SÍ ⏳' : 'NO ✅'}
          </Text>
        </View>

        {/* Par */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Par:
          </Text>
          <Text style={[styles.value, { color: theme.textPrimary }]}>
            {pair ? `${pair.symbol} (ID: ${pair.id})` : 'null ❌'}
          </Text>
        </View>

        {/* Interval */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Intervalo:
          </Text>
          <Text style={[styles.value, { color: theme.textPrimary }]}>
            {selectedInterval || 'null ❌'}
          </Text>
        </View>

        {/* Data */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Datos:
          </Text>
          <Text style={[styles.value, { color: theme.textPrimary }]}>
            {data ? `Array de ${data.length} items` : 'null ❌'}
          </Text>
        </View>

        {/* Data Preview */}
        {data && data.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Primer item:
            </Text>
            <Text style={[styles.code, { color: theme.textMuted }]}>
              {JSON.stringify(data[0], null, 2)}
            </Text>
          </View>
        )}

        {/* Estructura esperada */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Estructura esperada:
          </Text>
          <Text style={[styles.code, { color: theme.textMuted }]}>
{`{
  time: 1699564800,  // timestamp
  open: 43250.00,
  high: 43300.00,
  low: 43200.00,
  close: 43280.00,
  volume: 1500000
}`}
          </Text>
        </View>

        {/* Validaciones */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Validaciones:
          </Text>
          <Text style={[styles.value, { color: theme.textPrimary }]}>
            {!data ? '❌ Data es null/undefined' : 
             data.length === 0 ? '❌ Array vacío' :
             !data[0].time ? '❌ Falta campo "time"' :
             !data[0].open ? '❌ Falta campo "open"' :
             !data[0].close ? '❌ Falta campo "close"' :
             '✅ Datos válidos'}
          </Text>
        </View>

        {/* Instrucciones */}
        <View style={[styles.instructions, { backgroundColor: theme.background }]}>
          <Text style={[styles.instructionsTitle, { color: theme.brandPrimary }]}>
            📋 ¿Qué hacer?
          </Text>
          <Text style={[styles.instructionsText, { color: theme.textSecondary }]}>
            1. Si "Loading" está en SÍ por mucho tiempo: El endpoint no responde{'\n'}
            2. Si "Par" es null: No se cargaron los pares{'\n'}
            3. Si "Datos" es null: El endpoint de chart falla{'\n'}
            4. Si "Array vacío": El backend no tiene datos de ese par{'\n'}
            5. Si faltan campos: La estructura del backend es diferente{'\n'}
            {'\n'}
            Una vez identificado el problema, vuelve al chat.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 8,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  scroll: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  section: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: fontSize.base,
    fontWeight: '400',
  },
  code: {
    fontSize: fontSize.sm,
    fontFamily: 'monospace',
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: spacing.sm,
    borderRadius: 4,
  },
  instructions: {
    padding: spacing.md,
    borderRadius: 8,
    marginTop: spacing.md,
  },
  instructionsTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  instructionsText: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});

export default TradingChartDebug;