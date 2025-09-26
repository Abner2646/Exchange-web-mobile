// src/context/ThemeContext.jsx

import { createContext, useContext, useState, useEffect } from 'react';
import { themes } from './theme.config';

const ThemeContext = createContext(undefined);

export const ThemeProvider = ({ children }) => {
  const [themeMode, setThemeModeState] = useState(() => {
    const saved = localStorage.getItem('theme-mode');
    return saved || 'dark';
  });

  const theme = themes[themeMode];

  useEffect(() => {
    localStorage.setItem('theme-mode', themeMode);
    
    // Aplicar variables CSS al root
    const root = document.documentElement;
    
    // Backgrounds
    root.style.setProperty('--bg-primary', theme.colors.background.primary);
    root.style.setProperty('--bg-secondary', theme.colors.background.secondary);
    root.style.setProperty('--bg-tertiary', theme.colors.background.tertiary);
    root.style.setProperty('--bg-elevated', theme.colors.background.elevated);
    
    // Text
    root.style.setProperty('--text-primary', theme.colors.text.primary);
    root.style.setProperty('--text-secondary', theme.colors.text.secondary);
    root.style.setProperty('--text-tertiary', theme.colors.text.tertiary);
    root.style.setProperty('--text-disabled', theme.colors.text.disabled);
    root.style.setProperty('--text-inverse', theme.colors.text.inverse);
    
    // Brand
    root.style.setProperty('--brand-primary', theme.colors.brand.primary);
    root.style.setProperty('--brand-secondary', theme.colors.brand.secondary);
    root.style.setProperty('--brand-tertiary', theme.colors.brand.tertiary);
    
    // Semantic
    root.style.setProperty('--success', theme.colors.semantic.success);
    root.style.setProperty('--success-bg', theme.colors.semantic.successBg);
    root.style.setProperty('--error', theme.colors.semantic.error);
    root.style.setProperty('--error-bg', theme.colors.semantic.errorBg);
    root.style.setProperty('--warning', theme.colors.semantic.warning);
    root.style.setProperty('--warning-bg', theme.colors.semantic.warningBg);
    root.style.setProperty('--info', theme.colors.semantic.info);
    root.style.setProperty('--info-bg', theme.colors.semantic.infoBg);
    
    // Trading
    root.style.setProperty('--buy', theme.colors.trading.buy);
    root.style.setProperty('--buy-hover', theme.colors.trading.buyHover);
    root.style.setProperty('--buy-bg', theme.colors.trading.buyBg);
    root.style.setProperty('--sell', theme.colors.trading.sell);
    root.style.setProperty('--sell-hover', theme.colors.trading.sellHover);
    root.style.setProperty('--sell-bg', theme.colors.trading.sellBg);
    
    // Borders
    root.style.setProperty('--border-primary', theme.colors.border.primary);
    root.style.setProperty('--border-secondary', theme.colors.border.secondary);
    root.style.setProperty('--border-focus', theme.colors.border.focus);
    
    // Interactive
    root.style.setProperty('--interactive-hover', theme.colors.interactive.hover);
    root.style.setProperty('--interactive-active', theme.colors.interactive.active);
    root.style.setProperty('--interactive-disabled', theme.colors.interactive.disabled);
    
    // Chart
    root.style.setProperty('--chart-grid', theme.colors.chart.grid);
    root.style.setProperty('--chart-line', theme.colors.chart.line);
    root.style.setProperty('--chart-area', theme.colors.chart.area);
    root.style.setProperty('--chart-candle-up', theme.colors.chart.candle.up);
    root.style.setProperty('--chart-candle-down', theme.colors.chart.candle.down);
    
    // Spacing
    Object.entries(theme.spacing).forEach(([key, value]) => {
      root.style.setProperty(`--spacing-${key}`, value);
    });
    
    // Border radius
    Object.entries(theme.borderRadius).forEach(([key, value]) => {
      root.style.setProperty(`--radius-${key}`, value);
    });
    
    // Shadows
    Object.entries(theme.shadows).forEach(([key, value]) => {
      root.style.setProperty(`--shadow-${key}`, value);
    });
  }, [themeMode, theme]);

  const setThemeMode = (mode) => {
    setThemeModeState(mode);
  };

  const toggleTheme = () => {
    const modes = ['light', 'dark', 'crypto'];
    const currentIndex = modes.indexOf(themeMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setThemeModeState(modes[nextIndex]);
  };

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};