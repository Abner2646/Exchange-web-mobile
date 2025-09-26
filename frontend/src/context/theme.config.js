// src/context/theme.config.js

// TEMA CLARO (basado en Coinbase)
const lightColors = {
  background: {
    primary: '#FFFFFF',
    secondary: '#F5F8FA',
    tertiary: '#E8EEF2',
    elevated: '#FFFFFF',
  },
  text: {
    primary: '#050F19',
    secondary: '#5B616E',
    tertiary: '#8C919A',
    disabled: '#B8BBBF',
    inverse: '#FFFFFF',
  },
  brand: {
    primary: '#0052FF',
    secondary: '#1652F0',
    tertiary: '#E7F0FF',
  },
  semantic: {
    success: '#05B169',
    successBg: '#E6F5F0',
    error: '#DF5F67',
    errorBg: '#FBECED',
    warning: '#F4B944',
    warningBg: '#FFF8E6',
    info: '#0052FF',
    infoBg: '#E7F0FF',
  },
  trading: {
    buy: '#05B169',
    buyHover: '#049D5B',
    buyBg: '#E6F5F0',
    sell: '#DF5F67',
    sellHover: '#C9545B',
    sellBg: '#FBECED',
  },
  border: {
    primary: '#D8DCE0',
    secondary: '#E8EEF2',
    focus: '#0052FF',
  },
  interactive: {
    hover: '#F5F8FA',
    active: '#E8EEF2',
    disabled: '#F5F8FA',
  },
  chart: {
    grid: '#E8EEF2',
    line: '#0052FF',
    area: 'rgba(0, 82, 255, 0.1)',
    candle: {
      up: '#05B169',
      down: '#DF5F67',
    },
  },
};

// TEMA OSCURO
const darkColors = {
  background: {
    primary: '#0A0E13',
    secondary: '#141A20',
    tertiary: '#1E2329',
    elevated: '#1E2329',
  },
  text: {
    primary: '#EAECEF',
    secondary: '#B7BDC6',
    tertiary: '#848E9C',
    disabled: '#5E6673',
    inverse: '#0A0E13',
  },
  brand: {
    primary: '#3B82F6',
    secondary: '#2563EB',
    tertiary: '#1E3A8A',
  },
  semantic: {
    success: '#10B981',
    successBg: '#064E3B',
    error: '#EF4444',
    errorBg: '#7F1D1D',
    warning: '#F59E0B',
    warningBg: '#78350F',
    info: '#3B82F6',
    infoBg: '#1E3A8A',
  },
  trading: {
    buy: '#10B981',
    buyHover: '#059669',
    buyBg: '#064E3B',
    sell: '#EF4444',
    sellHover: '#DC2626',
    sellBg: '#7F1D1D',
  },
  border: {
    primary: '#2B3139',
    secondary: '#1E2329',
    focus: '#3B82F6',
  },
  interactive: {
    hover: '#1E2329',
    active: '#2B3139',
    disabled: '#1E2329',
  },
  chart: {
    grid: '#2B3139',
    line: '#3B82F6',
    area: 'rgba(59, 130, 246, 0.1)',
    candle: {
      up: '#10B981',
      down: '#EF4444',
    },
  },
};

// TEMA CRYPTO (colores vibrantes crypto-nativos)
const cryptoColors = {
  background: {
    primary: '#0D0D2B',
    secondary: '#1A1A3E',
    tertiary: '#252551',
    elevated: '#1A1A3E',
  },
  text: {
    primary: '#F0F0F3',
    secondary: '#B8B8D1',
    tertiary: '#8787A3',
    disabled: '#5E5E73',
    inverse: '#0D0D2B',
  },
  brand: {
    primary: '#7C3AED',
    secondary: '#9333EA',
    tertiary: '#4C1D95',
  },
  semantic: {
    success: '#00D4AA',
    successBg: '#003D32',
    error: '#FF4D4D',
    errorBg: '#4D1F1F',
    warning: '#FFB800',
    warningBg: '#4D3800',
    info: '#00B8D4',
    infoBg: '#003844',
  },
  trading: {
    buy: '#00D4AA',
    buyHover: '#00BF99',
    buyBg: '#003D32',
    sell: '#FF4D4D',
    sellHover: '#E64444',
    sellBg: '#4D1F1F',
  },
  border: {
    primary: '#363662',
    secondary: '#252551',
    focus: '#7C3AED',
  },
  interactive: {
    hover: '#252551',
    active: '#363662',
    disabled: '#1A1A3E',
  },
  chart: {
    grid: '#252551',
    line: '#7C3AED',
    area: 'rgba(124, 58, 237, 0.15)',
    candle: {
      up: '#00D4AA',
      down: '#FF4D4D',
    },
  },
};

// Configuración común para todos los temas
const commonConfig = {
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem',
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
};

export const themes = {
  light: {
    mode: 'light',
    colors: lightColors,
    ...commonConfig,
  },
  dark: {
    mode: 'dark',
    colors: darkColors,
    ...commonConfig,
  },
  crypto: {
    mode: 'crypto',
    colors: cryptoColors,
    ...commonConfig,
  },
};