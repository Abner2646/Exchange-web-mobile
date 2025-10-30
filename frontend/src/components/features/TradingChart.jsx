// src/components/features/TradingChart.jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import * as LightweightCharts from 'lightweight-charts';
import { useTheme } from '../../context/ThemeContext';
import '../../styles/TradingChart.css';

// ============================================
// UTILITARIOS PARA INDICADORES TÉCNICOS
// ============================================

// Calcular SMA (Simple Moving Average)
const calculateSMA = (data, period) => {
  const result = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({
      time: data[i].time,
      value: sum / period
    });
  }
  return result;
};

// Calcular EMA (Exponential Moving Average)
const calculateEMA = (data, period) => {
  const result = [];
  const multiplier = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((sum, candle) => sum + candle.close, 0) / period;
  
  result.push({ time: data[period - 1].time, value: ema });
  
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
    result.push({ time: data[i].time, value: ema });
  }
  return result;
};

// Calcular RSI (Relative Strength Index)
const calculateRSI = (data, period = 14) => {
  const result = [];
  let gains = 0;
  let losses = 0;
  
  // Primera media
  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change >= 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  let rs = avgGain / avgLoss;
  let rsi = 100 - (100 / (1 + rs));
  
  result.push({ time: data[period].time, value: rsi });
  
  // RSI subsiguientes
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    
    if (change >= 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - change) / period;
    }
    
    rs = avgGain / avgLoss;
    rsi = 100 - (100 / (1 + rs));
    result.push({ time: data[i].time, value: rsi });
  }
  
  return result;
};

// Calcular MACD
const calculateMACD = (data) => {
  const ema12 = calculateEMA(data, 12);
  const ema26 = calculateEMA(data, 26);
  
  const macdLine = [];
  for (let i = 0; i < ema12.length; i++) {
    const ema26Value = ema26.find(e => e.time === ema12[i].time);
    if (ema26Value) {
      macdLine.push({
        time: ema12[i].time,
        value: ema12[i].value - ema26Value.value
      });
    }
  }
  
  const signalLine = calculateEMA(
    macdLine.map((m, i) => ({ close: m.value, time: m.time })),
    9
  );
  
  const histogram = [];
  for (let i = 0; i < macdLine.length; i++) {
    const signal = signalLine.find(s => s.time === macdLine[i].time);
    if (signal) {
      histogram.push({
        time: macdLine[i].time,
        value: macdLine[i].value - signal.value,
        color: macdLine[i].value > signal.value ? 'rgba(14, 203, 129, 0.6)' : 'rgba(246, 70, 93, 0.6)'
      });
    }
  }
  
  return { macdLine, signalLine, histogram };
};

// Calcular Bollinger Bands
const calculateBollingerBands = (data, period = 20, stdDev = 2) => {
  const sma = calculateSMA(data, period);
  const upperBand = [];
  const lowerBand = [];
  
  for (let i = 0; i < sma.length; i++) {
    const dataIndex = i + period - 1;
    let sumSquares = 0;
    
    for (let j = 0; j < period; j++) {
      sumSquares += Math.pow(data[dataIndex - j].close - sma[i].value, 2);
    }
    
    const standardDeviation = Math.sqrt(sumSquares / period);
    
    upperBand.push({
      time: sma[i].time,
      value: sma[i].value + (stdDev * standardDeviation)
    });
    
    lowerBand.push({
      time: sma[i].time,
      value: sma[i].value - (stdDev * standardDeviation)
    });
  }
  
  return { sma, upperBand, lowerBand };
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

const TradingChart = ({ data = [], pair, loading, onIntervalChange }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const indicatorSeriesRef = useRef({});
  const resizeObserverRef = useRef(null);
  const { themeMode } = useTheme();
  
  const [selectedInterval, setSelectedInterval] = useState('1h');
  const [chartType, setChartType] = useState('candlestick'); // candlestick, line, area, bars
  const [activeIndicators, setActiveIndicators] = useState({
    ma7: false,
    ma25: false,
    ma99: false,
    ema7: false,
    ema25: false,
    rsi: false,
    macd: false,
    bollinger: false
  });
  const [showVolume, setShowVolume] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showIndicators, setShowIndicators] = useState(false);
  const [showIntervalDropdown, setShowIntervalDropdown] = useState(false);

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

  const chartTypes = [
    { value: 'candlestick', label: 'Candlestick' },
    { value: 'line', label: 'Line' },
    { value: 'area', label: 'Area' },
    { value: 'bars', label: 'Bars' }
  ];

  // Configuración del tema
  const getChartOptions = () => {
    const isDark = themeMode === 'dark' || themeMode === 'bitflow';
    
    const priceScaleBottom = showVolume ? 0.18 : 0.1; /* 0.08 */
    console.log('🔍 DEBUG - Price scale bottom margin:', priceScaleBottom);
    
    return {
      layout: {
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
        mode: 0, // 0 = Normal (libre), 1 = Magnet (se pega a velas)
        vertLine: {
          color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
          width: 1,
          style: 3,
          labelBackgroundColor: isDark ? '#2B2F36' : '#E8E9EB',
        },
        horzLine: {
          color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
          width: 1,
          style: 3,
          labelBackgroundColor: isDark ? '#2B2F36' : '#E8E9EB',
        },
      },
      rightPriceScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        scaleMargins: {
          top: 0.1,
          bottom: priceScaleBottom,
        },
      },
      timeScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
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
  };

  // Aplicar indicadores técnicos
  const applyIndicators = useCallback(() => {
    if (!chartRef.current || data.length < 100) return;

    // Limpiar indicadores previos
    Object.values(indicatorSeriesRef.current).forEach(series => {
      if (series && typeof series.setData === 'function') {
        try {
          chartRef.current.removeSeries(series);
        } catch (e) {
          console.log('Serie ya removida');
        }
      }
    });
    indicatorSeriesRef.current = {};

    // MA7
    if (activeIndicators.ma7) {
      const ma7Data = calculateSMA(data, 7);
      const ma7Series = chartRef.current.addLineSeries({
        color: '#FFB800',
        lineWidth: 2,
        title: 'MA7',
      });
      ma7Series.setData(ma7Data);
      indicatorSeriesRef.current.ma7 = ma7Series;
    }

    // MA25
    if (activeIndicators.ma25) {
      const ma25Data = calculateSMA(data, 25);
      const ma25Series = chartRef.current.addLineSeries({
        color: '#FF6838',
        lineWidth: 2,
        title: 'MA25',
      });
      ma25Series.setData(ma25Data);
      indicatorSeriesRef.current.ma25 = ma25Series;
    }

    // MA99
    if (activeIndicators.ma99) {
      const ma99Data = calculateSMA(data, 99);
      const ma99Series = chartRef.current.addLineSeries({
        color: '#2962FF',
        lineWidth: 2,
        title: 'MA99',
      });
      ma99Series.setData(ma99Data);
      indicatorSeriesRef.current.ma99 = ma99Series;
    }

    // EMA7
    if (activeIndicators.ema7) {
      const ema7Data = calculateEMA(data, 7);
      const ema7Series = chartRef.current.addLineSeries({
        color: '#00E396',
        lineWidth: 2,
        lineStyle: 2,
        title: 'EMA7',
      });
      ema7Series.setData(ema7Data);
      indicatorSeriesRef.current.ema7 = ema7Series;
    }

    // EMA25
    if (activeIndicators.ema25) {
      const ema25Data = calculateEMA(data, 25);
      const ema25Series = chartRef.current.addLineSeries({
        color: '#775DD0',
        lineWidth: 2,
        lineStyle: 2,
        title: 'EMA25',
      });
      ema25Series.setData(ema25Data);
      indicatorSeriesRef.current.ema25 = ema25Series;
    }

    // Bollinger Bands
    if (activeIndicators.bollinger) {
      const { sma, upperBand, lowerBand } = calculateBollingerBands(data, 20, 2);
      
      const upperSeries = chartRef.current.addLineSeries({
        color: 'rgba(33, 150, 243, 0.5)',
        lineWidth: 1,
        title: 'BB Upper',
      });
      upperSeries.setData(upperBand);
      indicatorSeriesRef.current.bbUpper = upperSeries;

      const middleSeries = chartRef.current.addLineSeries({
        color: 'rgba(33, 150, 243, 0.8)',
        lineWidth: 1,
        lineStyle: 2,
        title: 'BB Middle',
      });
      middleSeries.setData(sma);
      indicatorSeriesRef.current.bbMiddle = middleSeries;

      const lowerSeries = chartRef.current.addLineSeries({
        color: 'rgba(33, 150, 243, 0.5)',
        lineWidth: 1,
        title: 'BB Lower',
      });
      lowerSeries.setData(lowerBand);
      indicatorSeriesRef.current.bbLower = lowerSeries;
    }

    // RSI (en panel separado - simplificado para este ejemplo)
    if (activeIndicators.rsi) {
      const rsiData = calculateRSI(data, 14);
      // En un exchange real, esto iría en un panel separado debajo del gráfico principal
      console.log('RSI calculado:', rsiData.slice(-5));
    }

    // MACD (en panel separado - simplificado)
    if (activeIndicators.macd) {
      const { macdLine, signalLine, histogram } = calculateMACD(data);
      console.log('MACD calculado:', {
        macd: macdLine.slice(-3),
        signal: signalLine.slice(-3),
        histogram: histogram.slice(-3)
      });
    }
  }, [data, activeIndicators]);

  // Crear/Recrear el gráfico
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const timeoutId = setTimeout(() => {
      // Limpiar gráfico anterior
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        candlestickSeriesRef.current = null;
        volumeSeriesRef.current = null;
        indicatorSeriesRef.current = {};
      }

      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      const wrapper = chartContainerRef.current;
      if (!wrapper) return;

      const rect = wrapper.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      console.log('🔍 DEBUG - Dimensiones del contenedor del gráfico:');
      console.log('   Width:', width, 'px');
      console.log('   Height:', height, 'px');
      console.log('   Wrapper element:', wrapper);

      if (width === 0 || height === 0) {
        console.warn('⚠️ Contenedor sin dimensiones válidas');
        return;
      }

      // Crear gráfico
      const chart = LightweightCharts.createChart(wrapper, {
        width: width,
        height: height,
        ...getChartOptions(),
      });

      chartRef.current = chart;

      // Crear serie según el tipo de gráfico seleccionado
      let mainSeries;
      
      if (chartType === 'candlestick') {
        mainSeries = chart.addCandlestickSeries({
          upColor: '#0ECB81',
          downColor: '#F6465D',
          borderUpColor: '#0ECB81',
          borderDownColor: '#F6465D',
          wickUpColor: '#0ECB81',
          wickDownColor: '#F6465D',
        });
      } else if (chartType === 'line') {
        mainSeries = chart.addLineSeries({
          color: '#2962FF',
          lineWidth: 2,
        });
      } else if (chartType === 'area') {
        mainSeries = chart.addAreaSeries({
          topColor: 'rgba(41, 98, 255, 0.4)',
          bottomColor: 'rgba(41, 98, 255, 0.0)',
          lineColor: '#2962FF',
          lineWidth: 2,
        });
      } else if (chartType === 'bars') {
        mainSeries = chart.addBarSeries({
          upColor: '#0ECB81',
          downColor: '#F6465D',
        });
      }

      candlestickSeriesRef.current = mainSeries;

      // Serie de volumen
      if (showVolume) {
        console.log('🔍 DEBUG - Creando serie de volumen con scaleMargins:');
        const volumeMargins = {
          top: 0.93, /* 0.93 */
          bottom: 0,
        };
        console.log('   Volume scaleMargins:', volumeMargins);
        
        const volumeSeries = chart.addHistogramSeries({
          color: '#26a69a',
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: '',
          scaleMargins: volumeMargins,
        });
        volumeSeriesRef.current = volumeSeries;
        
        console.log('   Volume series creada:', volumeSeries);
      }

      // Cargar datos
      if (data.length > 0) {
        if (chartType === 'line' || chartType === 'area') {
          const lineData = data.map(d => ({
            time: d.time,
            value: d.close
          }));
          mainSeries.setData(lineData);
        } else {
          mainSeries.setData(data);
        }
        
        if (showVolume && volumeSeriesRef.current) {
          const volumeData = data.map(d => ({
            time: d.time,
            value: d.volume,
            color: d.close >= d.open ? 'rgba(14, 203, 129, 0.5)' : 'rgba(246, 70, 93, 0.5)',
          }));
          
          console.log('🔍 DEBUG - Cargando datos de volumen:');
          console.log('   Total de puntos:', volumeData.length);
          console.log('   Primer punto:', volumeData[0]);
          console.log('   Último punto:', volumeData[volumeData.length - 1]);
          
          volumeSeriesRef.current.setData(volumeData);
        }
        
        chart.timeScale().fitContent();

        // Aplicar indicadores
        applyIndicators();
      }

      // Crosshair move handler (para movimiento libre, sin mostrar datos)
      chart.subscribeCrosshairMove((param) => {
        // Solo dejamos que el crosshair se mueva libremente
        // No actualizamos ningún estado para mostrar datos
      });

      // ResizeObserver
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
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [themeMode, chartType, showVolume, data, applyIndicators]);

  // Manejar cambio de intervalo
  const handleIntervalChange = (interval) => {
    setSelectedInterval(interval);
    setShowIntervalDropdown(false); // Cerrar dropdown después de seleccionar
    if (onIntervalChange) {
      onIntervalChange(interval);
    }
  };

  // Toggle indicador
  const toggleIndicator = (indicator) => {
    setActiveIndicators(prev => ({
      ...prev,
      [indicator]: !prev[indicator]
    }));
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      chartContainerRef.current?.parentElement?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Detectar cuando se sale de fullscreen con ESC
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Screenshot
  const takeScreenshot = () => {
    if (chartRef.current) {
      const canvas = chartContainerRef.current.querySelector('canvas');
      if (canvas) {
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${pair?.symbol || 'chart'}_${Date.now()}.png`;
          a.click();
          URL.revokeObjectURL(url);
        });
      }
    }
  };

  // Reset zoom
  const resetZoom = () => {
    chartRef.current?.timeScale().fitContent();
  };

  return (
    <div className={`tradingchart-container ${isFullscreen ? 'fullscreen' : ''}`}>
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

        <div className="tradingchart-controls">
          {/* Interval Dropdown */}
          <div className="tradingchart-interval-dropdown">
            <button
              className="tradingchart-interval-trigger"
              onClick={() => setShowIntervalDropdown(!showIntervalDropdown)}
            >
              <span>{intervals.find(i => i.value === selectedInterval)?.label || '1h'}</span>
              <svg className="tradingchart-icon-small" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showIntervalDropdown && (
              <div className="tradingchart-interval-menu">
                {intervals.map(interval => (
                  <button
                    key={interval.value}
                    className={`tradingchart-interval-option ${selectedInterval === interval.value ? 'active' : ''}`}
                    onClick={() => handleIntervalChange(interval.value)}
                  >
                    {interval.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="tradingchart-divider"></div>

          {/* Chart Type Selector */}
          {chartTypes.map(type => (
            <button
              key={type.value}
              className={`tradingchart-icon-btn ${chartType === type.value ? 'active' : ''}`}
              onClick={() => setChartType(type.value)}
              title={type.label}
            >
              <svg className="tradingchart-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {type.value === 'candlestick' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />}
                {type.value === 'line' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />}
                {type.value === 'area' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />}
                {type.value === 'bars' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />}
              </svg>
            </button>
          ))}

          {/* Divider */}
          <div className="tradingchart-divider"></div>

          {/* Tools */}
          <button 
            className={`tradingchart-icon-btn ${showIndicators ? 'active' : ''}`}
            onClick={() => setShowIndicators(!showIndicators)}
            title="Indicators"
          >
            <svg className="tradingchart-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </button>
          <button 
            className="tradingchart-icon-btn"
            onClick={takeScreenshot}
            title="Screenshot"
          >
            <svg className="tradingchart-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button 
            className="tradingchart-icon-btn"
            onClick={resetZoom}
            title="Reset Zoom"
          >
            <svg className="tradingchart-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button 
            className={`tradingchart-icon-btn ${showSettings ? 'active' : ''}`}
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <svg className="tradingchart-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button 
            className="tradingchart-icon-btn"
            onClick={toggleFullscreen}
            title="Fullscreen"
          >
            <svg className="tradingchart-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isFullscreen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Indicators Panel */}
      {showIndicators && (
        <div className="tradingchart-indicators-panel">
          <div className="indicators-section">
            <h4>Moving Averages</h4>
            <div className="indicators-grid">
              <label className="indicator-item">
                <input 
                  type="checkbox" 
                  checked={activeIndicators.ma7}
                  onChange={() => toggleIndicator('ma7')}
                />
                <span className="indicator-dot" style={{ backgroundColor: '#FFB800' }}></span>
                <span>MA(7)</span>
              </label>
              <label className="indicator-item">
                <input 
                  type="checkbox" 
                  checked={activeIndicators.ma25}
                  onChange={() => toggleIndicator('ma25')}
                />
                <span className="indicator-dot" style={{ backgroundColor: '#FF6838' }}></span>
                <span>MA(25)</span>
              </label>
              <label className="indicator-item">
                <input 
                  type="checkbox" 
                  checked={activeIndicators.ma99}
                  onChange={() => toggleIndicator('ma99')}
                />
                <span className="indicator-dot" style={{ backgroundColor: '#2962FF' }}></span>
                <span>MA(99)</span>
              </label>
              <label className="indicator-item">
                <input 
                  type="checkbox" 
                  checked={activeIndicators.ema7}
                  onChange={() => toggleIndicator('ema7')}
                />
                <span className="indicator-dot" style={{ backgroundColor: '#00E396' }}></span>
                <span>EMA(7)</span>
              </label>
              <label className="indicator-item">
                <input 
                  type="checkbox" 
                  checked={activeIndicators.ema25}
                  onChange={() => toggleIndicator('ema25')}
                />
                <span className="indicator-dot" style={{ backgroundColor: '#775DD0' }}></span>
                <span>EMA(25)</span>
              </label>
            </div>
          </div>

          <div className="indicators-section">
            <h4>Oscillators & Others</h4>
            <div className="indicators-grid">
              <label className="indicator-item">
                <input 
                  type="checkbox" 
                  checked={activeIndicators.rsi}
                  onChange={() => toggleIndicator('rsi')}
                />
                <span>RSI(14)</span>
              </label>
              <label className="indicator-item">
                <input 
                  type="checkbox" 
                  checked={activeIndicators.macd}
                  onChange={() => toggleIndicator('macd')}
                />
                <span>MACD</span>
              </label>
              <label className="indicator-item">
                <input 
                  type="checkbox" 
                  checked={activeIndicators.bollinger}
                  onChange={() => toggleIndicator('bollinger')}
                />
                <span className="indicator-dot" style={{ backgroundColor: 'rgba(33, 150, 243, 0.8)' }}></span>
                <span>Bollinger Bands</span>
              </label>
              <label className="indicator-item">
                <input 
                  type="checkbox" 
                  checked={showVolume}
                  onChange={() => setShowVolume(!showVolume)}
                />
                <span>Volume</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal/Sidebar */}
      {showSettings && (
        <>
          <div className="tradingchart-overlay" onClick={() => setShowSettings(false)}></div>
          <div className="tradingchart-settings-sidebar">
            <div className="settings-sidebar-header">
              <h3>Chart Settings</h3>
              <button className="settings-close-btn" onClick={() => setShowSettings(false)}>
                <svg className="tradingchart-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="settings-sidebar-content">
              <div className="settings-section">
                <h4>Display Options</h4>
                <label>
                  <span>Show Volume</span>
                  <input 
                    type="checkbox"
                    checked={showVolume}
                    onChange={() => setShowVolume(!showVolume)}
                  />
                </label>
              </div>
              <div className="settings-section">
                <h4>Chart Type</h4>
                <div className="settings-chart-types">
                  {chartTypes.map(type => (
                    <button
                      key={type.value}
                      className={`settings-chart-type-btn ${chartType === type.value ? 'active' : ''}`}
                      onClick={() => setChartType(type.value)}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-info">
                <h4>Keyboard Shortcuts</h4>
                <p>💡 <strong>Mouse wheel:</strong> Zoom in/out</p>
                <p>⌨️ <strong>+/-:</strong> Zoom in/out</p>
                <p>⌨️ <strong>←/→:</strong> Scroll left/right</p>
                <p>🖱️ <strong>Drag:</strong> Pan chart</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Active Indicators Badge */}
      {Object.values(activeIndicators).some(v => v) && (
        <div className="tradingchart-active-indicators">
          {activeIndicators.ma7 && <span className="indicator-badge" style={{ borderColor: '#FFB800' }}>MA7</span>}
          {activeIndicators.ma25 && <span className="indicator-badge" style={{ borderColor: '#FF6838' }}>MA25</span>}
          {activeIndicators.ma99 && <span className="indicator-badge" style={{ borderColor: '#2962FF' }}>MA99</span>}
          {activeIndicators.ema7 && <span className="indicator-badge" style={{ borderColor: '#00E396' }}>EMA7</span>}
          {activeIndicators.ema25 && <span className="indicator-badge" style={{ borderColor: '#775DD0' }}>EMA25</span>}
          {activeIndicators.bollinger && <span className="indicator-badge" style={{ borderColor: 'rgba(33, 150, 243, 0.8)' }}>BB</span>}
          {activeIndicators.rsi && <span className="indicator-badge">RSI</span>}
          {activeIndicators.macd && <span className="indicator-badge">MACD</span>}
        </div>
      )}

      {/* Chart */}
      <div className="tradingchart-wrapper">
        {loading && (
          <div className="tradingchart-loading">
            <div className="tradingchart-spinner"></div>
            <p>Loading professional chart...</p>
          </div>
        )}
        <div ref={chartContainerRef} className="tradingchart-canvas"></div>
      </div>
    </div>
  );
};

export default TradingChart;