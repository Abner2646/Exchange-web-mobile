// mobile/contexts/ThemeContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes } from '../constants/theme';

const ThemeContext = createContext({});

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState('light'); // ⭐ Default light
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme-mode'); // ⭐ Mismo key que web
      
      if (savedTheme && themes[savedTheme]) {
        setCurrentTheme(savedTheme);
        console.log('[ThemeContext] Tema cargado:', savedTheme);
      } else {
        console.log('[ThemeContext] Sin tema guardado, usando light');
      }
    } catch (error) {
      console.error('[ThemeContext] Error loading theme:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchTheme = async (themeName) => {
    if (themes[themeName]) {
      setCurrentTheme(themeName);
      await AsyncStorage.setItem('theme-mode', themeName); // ⭐ Mismo key que web
      console.log('[ThemeContext] Tema cambiado a:', themeName);
    }
  };

  const toggleTheme = async () => {
    const modes = ['light', 'dark', 'bitflow']; // ⭐ bitflow, no crypto
    const currentIndex = modes.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % modes.length;
    await switchTheme(modes[nextIndex]);
  };

  const theme = themes[currentTheme];

  // ⭐ LOGS DE DEBUG
  console.log('=== THEME DEBUG ===');
  console.log('Current theme:', currentTheme);
  console.log('Background:', theme.background);
  console.log('Text Primary:', theme.textPrimary);
  console.log('Brand Primary:', theme.brandPrimary); // ⭐ Color principal (azul)
  console.log('Success:', theme.success); // ⭐ Verde (solo para compras)
  console.log('Buy:', theme.buy); // ⭐ Verde (alias de success)
  console.log('==================');

  if (loading) {
    return null; // O un splash screen
  }

  return (
    <ThemeContext.Provider 
      value={{ 
        theme,
        currentTheme,
        themeMode: currentTheme, // ⭐ Alias para compatibilidad con web
        switchTheme,
        setThemeMode: switchTheme, // ⭐ Alias para compatibilidad con web
        toggleTheme,
      }}
    >
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