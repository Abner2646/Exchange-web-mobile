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

  // Configuración del tema
  const getChartOptions = () => {
    const isDark = themeMode === 'dark' || themeMode === 'bitflow';
    
    return {
      layout: {
        background: { color: 'transparent' },
        textColor: isDark ? '#D1D4DC' : '#191919',
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' },
        horzLines: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' },
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

  // Crear el gráfico
  useEffect(() => {
    if (!chartContainerRef.current) return;
    console.log('📈 Chart data received:', data);
  console.log('📊 Chart container:', chartContainerRef.current);
  console.log('📐 Container dimensions:', {
    width: chartContainerRef.current?.clientWidth,
    height: chartContainerRef.current?.clientHeight
  })

    // Crear instancia del gráfico
    const chart = LightweightCharts.createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      ...getChartOptions(),
    });

    chartRef.current = chart;

    // Crear serie de velas
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#0ECB81',
      downColor: '#F6465D',
      borderUpColor: '#0ECB81',
      borderDownColor: '#F6465D',
      wickUpColor: '#0ECB81',
      wickDownColor: '#F6465D',
    });

    candlestickSeriesRef.current = candlestickSeries;

    // Crear serie de volumen
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

    // Manejar resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [themeMode]);

  // Actualizar datos
  useEffect(() => {
    if (candlestickSeriesRef.current && data.length > 0) {
      candlestickSeriesRef.current.setData(data);
      
      // Actualizar volumen
      if (volumeSeriesRef.current) {
        const volumeData = data.map(d => ({
          time: d.time,
          value: d.volume,
          color: d.close >= d.open ? 'rgba(14, 203, 129, 0.5)' : 'rgba(246, 70, 93, 0.5)',
        }));
        volumeSeriesRef.current.setData(volumeData);
      }

      // Ajustar vista
      chartRef.current?.timeScale().fitContent();
    }
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