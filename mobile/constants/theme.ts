// Equivalente a tus variables CSS de la web
export const themes = {
  light: {
    // Backgrounds
    background: '#ffffff',
    backgroundElevated: '#f5f5f5',
    backgroundCard: '#ffffff',
    
    // Text
    textPrimary: '#1a1a1a',
    textSecondary: '#666666',
    textMuted: '#999999',
    
    // Borders
    border: '#e0e0e0',
    borderHover: '#cccccc',
    
    // Status colors
    success: '#00d4aa',
    danger: '#ff4444',
    warning: '#ffaa00',
    info: '#3b82f6',
    
    // Trading
    buy: '#00d4aa',
    sell: '#ff4444',
  },
  
  dark: {
    background: '#0a0e27',
    backgroundElevated: '#1a1f3a',
    backgroundCard: '#151a2e',
    
    textPrimary: '#ffffff',
    textSecondary: '#b8b8b8',
    textMuted: '#666666',
    
    border: '#2a2f4a',
    borderHover: '#3a3f5a',
    
    success: '#00d4aa',
    danger: '#ff4444',
    warning: '#ffaa00',
    info: '#3b82f6',
    
    buy: '#00d4aa',
    sell: '#ff4444',
  },
  
  crypto: {
    background: '#000000',
    backgroundElevated: '#0d0d0d',
    backgroundCard: '#1a1a1a',
    
    textPrimary: '#00ff88',
    textSecondary: '#00cc66',
    textMuted: '#006633',
    
    border: '#00ff8820',
    borderHover: '#00ff8840',
    
    success: '#00ff88',
    danger: '#ff0066',
    warning: '#ffaa00',
    info: '#00ccff',
    
    buy: '#00ff88',
    sell: '#ff0066',
  },
};

// Espaciado consistente (como tus variables de espaciado)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Bordes
export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
};

// Sombras
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
};

// Tamaños de fuente
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};