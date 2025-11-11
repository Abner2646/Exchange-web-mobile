// mobile/components/trading/TradingChart.js
import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, borderRadius, fontSize } from '../../constants/theme';

// Intentar importar WebView
let WebView;
try {
  WebView = require('react-native-webview').WebView;
} catch (error) {
  // WebView no está instalado
  WebView = null;
}

const TradingChart = ({ data, pair, selectedInterval, onIntervalChange, loading }) => {
  const { theme, themeMode } = useTheme();
  const webViewRef = useRef(null);
  const [webViewReady, setWebViewReady] = useState(false);

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

  // Si WebView no está instalado, mostrar mensaje
  if (!WebView) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.errorContainer, { backgroundColor: theme.backgroundSecondary }]}>
          <Ionicons name="alert-circle" size={48} color={theme.error} />
          <Text style={[styles.errorTitle, { color: theme.textPrimary }]}>
            WebView no instalado
          </Text>
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>
            Para ver el gráfico, necesitas instalar react-native-webview:{'\n\n'}
            <Text style={[styles.errorCode, { color: theme.brandPrimary }]}>
              npx expo install react-native-webview{'\n'}
              npx expo start --clear
            </Text>
          </Text>
        </View>
      </View>
    );
  }

  // Generar HTML con lightweight-charts
  const generateChartHTML = () => {
    const isDark = themeMode === 'dark' || themeMode === 'bitflow';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://unpkg.com/lightweight-charts@4.1.0/dist/lightweight-charts.standalone.production.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      background: ${isDark ? '#1a1d24' : '#ffffff'};
      overflow: hidden;
      touch-action: pan-x pan-y;
    }
    #chart {
      width: 100vw;
      height: 100vh;
    }
  </style>
</head>
<body>
  <div id="chart"></div>
  <script>
    const chartOptions = {
      layout: {
        background: { color: '${isDark ? '#1a1d24' : '#ffffff'}' },
        textColor: '${isDark ? '#D1D4DC' : '#191919'}',
      },
      grid: {
        vertLines: { color: '${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}' },
        horzLines: { color: '${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}' },
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: '${isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'}',
          width: 1,
          style: 3,
          labelBackgroundColor: '${isDark ? '#2B2F36' : '#E8E9EB'}',
        },
        horzLine: {
          color: '${isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'}',
          width: 1,
          style: 3,
          labelBackgroundColor: '${isDark ? '#2B2F36' : '#E8E9EB'}',
        },
      },
      rightPriceScale: {
        borderColor: '${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: '${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    };

    const chart = LightweightCharts.createChart(document.getElementById('chart'), chartOptions);
    
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#0ECB81',
      downColor: '#F6465D',
      borderUpColor: '#0ECB81',
      borderDownColor: '#F6465D',
      wickUpColor: '#0ECB81',
      wickDownColor: '#F6465D',
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: { top: 0.9, bottom: 0 },
    });

    // Función para actualizar datos
    window.updateChart = function(candleData, volumeData) {
      try {
        candlestickSeries.setData(candleData);
        volumeSeries.setData(volumeData);
        chart.timeScale().fitContent();
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
      } catch (error) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ 
          type: 'error', 
          error: error.message 
        }));
      }
    };

    // Resize handler
    window.addEventListener('resize', () => {
      chart.applyOptions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    });

    // Notificar que está listo
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
  </script>
</body>
</html>
    `;
  };

  // Actualizar gráfico cuando cambien los datos
  useEffect(() => {
    if (webViewReady && data && data.length > 0) {
      const candleData = data.map(d => ({
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));

      const volumeData = data.map(d => ({
        time: d.time,
        value: d.volume,
        color: d.close >= d.open ? 'rgba(14, 203, 129, 0.5)' : 'rgba(246, 70, 93, 0.5)',
      }));

      const updateScript = `
        window.updateChart(
          ${JSON.stringify(candleData)},
          ${JSON.stringify(volumeData)}
        );
      `;

      webViewRef.current?.injectJavaScript(updateScript);
    }
  }, [data, webViewReady]);

  // Actualizar tema cuando cambia
  useEffect(() => {
    if (webViewReady) {
      // Recargar WebView cuando cambia el tema
      setWebViewReady(false);
      setTimeout(() => setWebViewReady(true), 100);
    }
  }, [themeMode]);

  const handleWebViewMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'ready') {
        setWebViewReady(true);
      } else if (message.type === 'error') {
        console.error('Chart error:', message.error);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Interval selector */}
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
              selectedInterval === interval.value && [
                styles.intervalBtnActive,
                { backgroundColor: theme.brandPrimary }
              ],
            ]}
            onPress={() => onIntervalChange(interval.value)}
          >
            <Ionicons 
              name="bar-chart-outline" 
              size={16} 
              color={selectedInterval === interval.value ? '#ffffff' : theme.textSecondary} 
              style={styles.intervalIcon}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Chart */}
      <View style={styles.chartContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.brandPrimary} />
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ html: generateChartHTML() }}
            onMessage={handleWebViewMessage}
            style={styles.webView}
            scrollEnabled={false}
            bounces={false}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={false}
            androidHardwareAccelerationDisabled={false}
            androidLayerType="hardware"
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  intervalsContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  intervalsContent: {
    gap: spacing.xs,
  },
  intervalBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  intervalBtnActive: {
    borderRadius: borderRadius.sm,
  },
  intervalIcon: {
    marginRight: 4,
  },
  chartContainer: {
    flex: 1,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    margin: spacing.md,
    borderRadius: borderRadius.md,
  },
  errorTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: fontSize.base,
    textAlign: 'center',
    lineHeight: 24,
  },
  errorCode: {
    fontFamily: 'monospace',
    fontSize: fontSize.sm,
  },
});

export default TradingChart;