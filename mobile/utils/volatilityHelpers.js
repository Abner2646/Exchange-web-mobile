// mobile/utils/volatilityHelpers.js

/**
 * Calcular indicador de volatilidad basado en cambio 24h
 * @param {Number} change24h - Cambio porcentual en 24h
 * @returns {Object} { label, emoji, colorKey }
 */
export const getVolatilityIndicator = (change24h) => {
  const absChange = Math.abs(change24h);
  
  if (absChange >= 10) {
    return { 
      label: 'Muy Alta', 
      emoji: '🔥', 
      colorKey: 'error' 
    };
  }
  
  if (absChange >= 5) {
    return { 
      label: 'Alta', 
      emoji: '⚡', 
      colorKey: 'warning' 
    };
  }
  
  if (absChange >= 2) {
    return { 
      label: 'Moderada', 
      emoji: '📊', 
      colorKey: 'brandPrimary' 
    };
  }
  
  return { 
    label: 'Baja', 
    emoji: '😴', 
    colorKey: 'success' 
  };
};