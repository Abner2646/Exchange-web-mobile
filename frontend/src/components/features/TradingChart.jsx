// src/components/features/TradingChart.jsx
import { useEffect, useRef, useState } from 'react';
import * as LightweightCharts from 'lightweight-charts';
import { useTheme } from '../../context/ThemeContext';
import '../../styles/TradingChart.css';

const TradingChart = ({ data = [], pair, loading, onIntervalChange }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const { themeMode } = useTheme();
  
  const [selectedInterval, setSelectedInterval] = useState('1h');

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

  // ✅ SOLUCIÓN: Configuración del tema con colores sólidos
  const getChartOptions = () => {
    const isDark = themeMode === 'dark' || themeMode === 'bitflow';
    
    return {
      layout: {
        // ✅ CAMBIO CRÍTICO: Fondo sólido en lugar de transparent
        background: { 
          color: isDark ? '#1a1d24' : '#ffffff' 
        },
        textColor: isDark ? '#D1D4DC' : '#191919',
      },
      grid: {
        vertLines: { 
          color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' 
        },
        horzLines: { 
          color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' 
        },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
          width: 1,
          style: 3,
        },
        horzLine: {
          color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
          width: 1,
          style: 3,
        },
      },
      rightPriceScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      },
      timeScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
    };
  };

  // ✅ Crear/Recrear el gráfico cuando cambia el tema
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // ✅ DELAY para asegurar que el DOM se haya actualizado
    const timeoutId = setTimeout(() => {
      // Limpiar gráfico anterior
      if (chartRef.current) {
        console.log('🗑️ Destruyendo chart anterior...');
        chartRef.current.remove();
        chartRef.current = null;
        candlestickSeriesRef.current = null;
        volumeSeriesRef.current = null;
      }

      // Desconectar ResizeObserver anterior
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      const wrapper = chartContainerRef.current;
      if (!wrapper) return;

      const rect = wrapper.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      console.log('📐 Creando chart con dimensiones:', { width, height, theme: themeMode });

      // Validar dimensiones
      if (width === 0 || height === 0) {
        console.warn('⚠️ Contenedor sin dimensiones válidas');
        return;
      }

      // ✅ Crear gráfico con configuración del tema actual
      const chart = LightweightCharts.createChart(wrapper, {
        width: width,
        height: height,
        ...getChartOptions(),
      });

      chartRef.current = chart;

      // Crear series de velas
      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#0ECB81',
        downColor: '#F6465D',
        borderUpColor: '#0ECB81',
        borderDownColor: '#F6465D',
        wickUpColor: '#0ECB81',
        wickDownColor: '#F6465D',
      });

      candlestickSeriesRef.current = candlestickSeries;

      // Crear series de volumen
      const volumeSeries = chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '',
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });

      volumeSeriesRef.current = volumeSeries;

      // ✅ Cargar datos existentes si los hay
      if (data.length > 0) {
        console.log('📊 Cargando', data.length, 'velas al chart');
        candlestickSeries.setData(data);
        
        const volumeData = data.map(d => ({
          time: d.time,
          value: d.volume,
          color: d.close >= d.open ? 'rgba(14, 203, 129, 0.5)' : 'rgba(246, 70, 93, 0.5)',
        }));
        volumeSeries.setData(volumeData);
        
        chart.timeScale().fitContent();
      }

      // ✅ ResizeObserver para manejar cambios de tamaño
      const resizeObserver = new ResizeObserver((entries) => {
        if (!chartRef.current || !wrapper) return;
        
        const entry = entries[0];
        const { width, height } = entry.contentRect;
        
        if (width > 0 && height > 0) {
          chartRef.current.applyOptions({
            width: width,
            height: height,
          });
          
          chartRef.current.timeScale().fitContent();
        }
      });

      resizeObserver.observe(wrapper);
      resizeObserverRef.current = resizeObserver;

      console.log('✅ Chart creado exitosamente');
    }, 50); // ✅ Pequeño delay para asegurar que el DOM esté listo

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      
      if (chartRef.current) {
        console.log('🧹 Limpiando chart en cleanup');
        chartRef.current.remove();
        chartRef.current = null;
        candlestickSeriesRef.current = null;
        volumeSeriesRef.current = null;
      }
    };
  }, [themeMode]); // ✅ Se recrea cuando cambia el tema

  // ✅ Actualizar datos cuando cambian (independiente del tema)
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current) return;
    if (data.length === 0) return;

    console.log('📊 Actualizando datos del chart:', data.length, 'velas');

    candlestickSeriesRef.current.setData(data);
    
    const volumeData = data.map(d => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? 'rgba(14, 203, 129, 0.5)' : 'rgba(246, 70, 93, 0.5)',
    }));
    volumeSeriesRef.current.setData(volumeData);

    chartRef.current?.timeScale().fitContent();
  }, [data]);

  // Manejar cambio de intervalo
  const handleIntervalChange = (interval) => {
    setSelectedInterval(interval);
    if (onIntervalChange) {
      onIntervalChange(interval);
    }
  };

  return (
    <div className="tradingchart-container">
      {/* Header */}
      <div className="tradingchart-header">
        <div className="tradingchart-info">
          <h3 className="tradingchart-pair">
            {pair?.symbol || 'BTC/USDT'}
          </h3>
          {pair && (
            <div className="tradingchart-stats">
              <span className="tradingchart-price">
                ${parseFloat(pair.lastPrice).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 8,
                })}
              </span>
              <span className={`tradingchart-change ${parseFloat(pair.priceChange24h) >= 0 ? 'positive' : 'negative'}`}>
                {parseFloat(pair.priceChange24h) >= 0 ? '+' : ''}
                {parseFloat(pair.priceChange24h).toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        {/* Interval selector */}
        <div className="tradingchart-intervals">
          {intervals.map(interval => (
            <button
              key={interval.value}
              className={`tradingchart-interval-btn ${selectedInterval === interval.value ? 'active' : ''}`}
              onClick={() => handleIntervalChange(interval.value)}
            >
              {interval.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="tradingchart-wrapper">
        {loading && (
          <div className="tradingchart-loading">
            <div className="tradingchart-spinner"></div>
            <p>Cargando gráfico...</p>
          </div>
        )}
        <div ref={chartContainerRef} className="tradingchart-canvas"></div>
      </div>
    </div>
  );
};

export default TradingChart;