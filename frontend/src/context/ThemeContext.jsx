import React, { createContext, useContext } from 'react';
import { useTheme } from '../hooks/useTheme';

// Create the context
const ThemeContext = createContext();

/**
 * Theme context provider
 * @param {Object} props - Component Props
 * @param {React.ReactNode} props.children - Child components
 */
export const ThemeProvider = ({ children }) => {
  const themeData = useTheme();

  return (
    <ThemeContext.Provider value={themeData}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook to use the theme context
 * @returns {Object} Topic data from context
 */
export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  
  return context;
};