// mobile/components/trading/TradingChart.js
// ✅ VERSIÓN MEJORADA: Altura 3x + Fix intervalos

import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, borderRadius, fontSize } from '../../constants/theme';

// Intentar importar WebView
let WebView;
let webViewAvailable = false;
try {
  WebView = require('react-native-webview').WebView;
  webViewAvailable = true;
  console.log('✅ WebView disponible');
} catch (error) {
  console.log('❌ WebView NO disponible');
  webViewAvailable = false;
}

// Datos mock para demostración
const MOCK_DATA = [
  { time: Math.floor(Date.now() / 1000) - 3600 * 24, open: 42800, high: 43100, low: 42700, close: 43000, volume: 1500000 },
  { time: Math.floor(Date.now() / 1000) - 3600 * 20, open: 43000, high: 43400, low: 42900, close: 43200, volume: 1800000 },
  { time: Math.floor(Date.now() / 1000) - 3600 * 16, open: 43200, high: 43500, low: 43000, close: 43300, volume: 2100000 },
  { time: Math.floor(Date.now() / 1000) - 3600 * 12, open: 43300, high: 43800, low: 43200, close: 43500, volume: 2400000 },
  { time: Math.floor(Date.now() / 1000) - 3600 * 8, open: 43500, high: 43900, low: 43400, close: 43700, volume: 2200000 },
  { time: Math.floor(Date.now() / 1000) - 3600 * 4, open: 43700, high: 44200, low: 43600, close: 44000, volume: 2600000 },
  { time: Math.floor(Date.now() / 1000), open: 44000, high: 44300, low: 43900, close: 44100, volume: 2300000 },
];

const TradingChart = ({ data, pair, selectedInterval, onIntervalChange, loading }) => {
  const { theme, themeMode } = useTheme();
  const webViewRef = useRef(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now()); // ← Para forzar updates

  const intervals = [
    { value: '1m', label: '1m' },
    { value: '5m', label: '5m' },
    { value: '15m', label: '15m' },
    { value: '30m', label: '30m' },
    { value: '1h', label: '1h' },
    { value: '4h', label: '4h' },
    { value: '1d', label: '1D' },
    { value: '1w', label: '1W' },
  ];

  // Usar datos mock si no hay datos reales
  const chartData = (data && data.length > 0) ? data : MOCK_DATA;
  const isUsingMockData = !data || data.length === 0;

  useEffect(() => {
    console.log('📊 TradingChart mounted');
    console.log('  WebView available:', webViewAvailable);
    console.log('  Data length:', data?.length || 0);
    console.log('  Using mock data:', isUsingMockData);
  }, []);

  // Si WebView no está disponible
  if (!webViewAvailable) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.intervalsContainer}
          contentContainerStyle={styles.intervalsContent}
        >
          {intervals.map(interval => (
            <TouchableOpacity
              key={interval.value}
              style={[
                styles.intervalBtn,
                { backgroundColor: theme.backgroundSecondary },
                selectedInterval === interval.value && { backgroundColor: theme.brandPrimary },
              ]}
              onPress={() => onIntervalChange(interval.value)}
            >
              <Text style={[
                styles.intervalText,
                { color: selectedInterval === interval.value ? '#ffffff' : theme.textSecondary }
              ]}>
                {interval.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={[styles.errorContainer, { backgroundColor: theme.backgroundSecondary }]}>
          <Ionicons name="alert-circle" size={48} color={theme.error} />
          <Text style={[styles.errorTitle, { color: theme.textPrimary }]}>
            WebView no instalado
          </Text>
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>
            Para ver el gráfico profesional, instala react-native-webview:
          </Text>
          <View style={[styles.codeBlock, { backgroundColor: theme.background }]}>
            <Text style={[styles.codeText, { color: theme.brandPrimary }]}>
              npx expo install react-native-webview{'\n'}
              npx expo start --clear
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Generar HTML del gráfico
  const generateChartHTML = () => {
    const isDark = themeMode === 'dark' || themeMode === 'bitflow';
    
    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://unpkg.com/lightweight-charts@4.1.0/dist/lightweight-charts.standalone.production.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: ${isDark ? '#1a1d24' : '#ffffff'}; overflow: hidden; }
    #chart { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="chart"></div>
  <script>
    try {
      const chart = LightweightCharts.createChart(document.getElementById('chart'), {
        layout: { background: { color: '${isDark ? '#1a1d24' : '#ffffff'}' }, textColor: '${isDark ? '#D1D4DC' : '#191919'}' },
        grid: { vertLines: { color: '${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}' }, horzLines: { color: '${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}' } },
        rightPriceScale: { borderColor: '${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}' },
        timeScale: { borderColor: '${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}', timeVisible: true },
      });
      
      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#0ECB81', downColor: '#F6465D',
        borderUpColor: '#0ECB81', borderDownColor: '#F6465D',
        wickUpColor: '#0ECB81', wickDownColor: '#F6465D',
      });

      const volumeSeries = chart.addHistogramSeries({
        color: '#26a69a', priceFormat: { type: 'volume' },
        priceScaleId: '', scaleMargins: { top: 0.9, bottom: 0 },
      });

      window.updateChart = function(candleData, volumeData) {
        try {
          candlestickSeries.setData(candleData);
          volumeSeries.setData(volumeData);
          chart.timeScale().fitContent();
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
        } catch (error) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: error.message }));
        }
      };

      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    } catch (error) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: error.message }));
    }
  </script>
</body>
</html>`;
  };

  // Actualizar gráfico cuando cambien los datos O el intervalo
  useEffect(() => {
    if (webViewReady && chartData && chartData.length > 0) {
      console.log('📈 === INYECTANDO DATOS AL GRÁFICO ===');
      console.log('  Datos:', chartData.length, 'items');
      console.log('  Intervalo:', selectedInterval);
      console.log('  Primer dato:', chartData[0]);
      
      const candleData = chartData.map(d => ({
        time: d.time,
        open: parseFloat(d.open),
        high: parseFloat(d.high),
        low: parseFloat(d.low),
        close: parseFloat(d.close),
      }));

      const volumeData = chartData.map(d => ({
        time: d.time,
        value: parseFloat(d.volume),
        color: d.close >= d.open ? 'rgba(14, 203, 129, 0.5)' : 'rgba(246, 70, 93, 0.5)',
      }));

      const updateScript = `
        console.log('🔄 Recibiendo actualización desde React Native');
        window.updateChart(${JSON.stringify(candleData)}, ${JSON.stringify(volumeData)});
        true;
      `;

      console.log('📤 Inyectando script...');
      webViewRef.current?.injectJavaScript(updateScript);
      setLastUpdate(Date.now()); // ← Marcar última actualización
      console.log('✅ Script inyectado');
    } else {
      console.log('⚠️ No se puede actualizar gráfico:');
      console.log('  webViewReady:', webViewReady);
      console.log('  chartData:', chartData?.length || 0);
    }
  }, [chartData, selectedInterval]); // ← IMPORTANTE: Incluir selectedInterval

  const handleWebViewMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('📨 Mensaje de WebView:', message.type);
      
      if (message.type === 'ready') {
        console.log('✅ WebView ready - listo para recibir datos');
        setWebViewReady(true);
        
        // Si ya hay datos, inyectarlos inmediatamente
        if (chartData && chartData.length > 0) {
          console.log('📊 Hay datos disponibles, inyectando inmediatamente...');
          setTimeout(() => {
            const candleData = chartData.map(d => ({
              time: d.time,
              open: parseFloat(d.open),
              high: parseFloat(d.high),
              low: parseFloat(d.low),
              close: parseFloat(d.close),
            }));

            const volumeData = chartData.map(d => ({
              time: d.time,
              value: parseFloat(d.volume),
              color: d.close >= d.open ? 'rgba(14, 203, 129, 0.5)' : 'rgba(246, 70, 93, 0.5)',
            }));

            const updateScript = `
              window.updateChart(${JSON.stringify(candleData)}, ${JSON.stringify(volumeData)});
              true;
            `;
            webViewRef.current?.injectJavaScript(updateScript);
            console.log('✅ Datos iniciales inyectados');
          }, 100);
        }
      } else if (message.type === 'error') {
        console.error('❌ Chart error:', message.error);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Interval selector + Debug toggle */}
      <View style={styles.topRow}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.intervalsContainer}
          contentContainerStyle={styles.intervalsContent}
        >
          {intervals.map(interval => (
            <TouchableOpacity
              key={interval.value}
              style={[
                styles.intervalBtn,
                { backgroundColor: theme.backgroundSecondary },
                selectedInterval === interval.value && { backgroundColor: theme.brandPrimary },
              ]}
              onPress={() => {
                console.log('⏱️ Cambiando a intervalo:', interval.value);
                onIntervalChange(interval.value);
              }}
            >
              <Text style={[
                styles.intervalText,
                { color: selectedInterval === interval.value ? '#ffffff' : theme.textSecondary }
              ]}>
                {interval.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[styles.debugBtn, { backgroundColor: theme.backgroundSecondary }]}
          onPress={() => setDebugMode(!debugMode)}
        >
          <Ionicons 
            name={debugMode ? "bug" : "information-circle"} 
            size={20} 
            color={debugMode ? theme.error : theme.textMuted} 
          />
        </TouchableOpacity>
      </View>

      {/* Mock data notice */}
      {isUsingMockData && (
        <View style={[styles.mockNotice, { backgroundColor: theme.warning + '20' }]}>
          <Ionicons name="information-circle" size={16} color={theme.warning} />
          <Text style={[styles.mockText, { color: theme.warning }]}>
            Mostrando datos de demostración
          </Text>
        </View>
      )}

      {/* Debug info */}
      {debugMode && (
        <View style={[styles.debugInfo, { backgroundColor: theme.backgroundSecondary }]}>
          <Text style={[styles.debugText, { color: theme.textSecondary }]}>
            WebView: ✅ | Ready: {webViewReady ? '✅' : '⏳'} | Data: {chartData.length} | Mock: {isUsingMockData ? 'SÍ' : 'NO'} | Interval: {selectedInterval} | Updated: {new Date(lastUpdate).toLocaleTimeString()}
          </Text>
        </View>
      )}

      {/* Chart - ALTURA AUMENTADA 3X */}
      <View style={styles.chartContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.brandPrimary} />
            <Text style={[styles.loadingText, { color: theme.textMuted }]}>Cargando gráfico...</Text>
          </View>
        ) : (
          <WebView
            key={`chart-${pair?.id || 'default'}`}
            ref={webViewRef}
            source={{ html: generateChartHTML() }}
            onMessage={handleWebViewMessage}
            onLoad={() => {
              console.log('🔄 WebView onLoad');
            }}
            onLoadEnd={() => {
              console.log('✅ WebView onLoadEnd');
            }}
            style={styles.webView}
            scrollEnabled={false}
            bounces={false}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            androidHardwareAccelerationDisabled={false}
            androidLayerType="hardware"
            onError={(syntheticEvent) => {
              console.error('❌ WebView error:', syntheticEvent.nativeEvent);
            }}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // NO usar flex: 1 para que funcione dentro de ScrollView
  },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  intervalsContainer: { flex: 1 },
  intervalsContent: { gap: spacing.xs },
  intervalBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: borderRadius.sm },
  intervalText: { fontSize: fontSize.sm, fontWeight: '600' },
  debugBtn: { padding: spacing.sm, borderRadius: borderRadius.sm, marginLeft: spacing.sm },
  mockNotice: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.sm, gap: spacing.xs },
  mockText: { fontSize: fontSize.xs, flex: 1 },
  debugInfo: { padding: spacing.sm, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.sm },
  debugText: { fontSize: fontSize.xs, fontFamily: 'monospace' },
  // ✅ SIN MÁRGENES LATERALES + ALTURA 400px (33% menos que 600)
  chartContainer: { 
    height: 400,  // ← 33% menos (antes 600px)
    // marginHorizontal: REMOVIDO para llegar a los bordes
    marginBottom: spacing.md, 
    borderRadius: 0,  // ← Sin border radius para que llegue a los bordes
    overflow: 'hidden' 
  },
  webView: { flex: 1, backgroundColor: 'transparent' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: fontSize.sm, marginTop: spacing.sm },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, margin: spacing.md, borderRadius: borderRadius.md },
  errorTitle: { fontSize: fontSize.xl, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.sm },
  errorText: { fontSize: fontSize.base, textAlign: 'center', marginBottom: spacing.md },
  codeBlock: { padding: spacing.md, borderRadius: borderRadius.sm, width: '100%' },
  codeText: { fontFamily: 'monospace', fontSize: fontSize.sm, textAlign: 'center' },
});

export default TradingChart;