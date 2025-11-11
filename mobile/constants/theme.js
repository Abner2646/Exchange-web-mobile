// mobile/constants/theme.js (mobile)

// ============================================
// TEMA CLARO (basado en Coinbase)
// ============================================
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
    primary: 'rgba(216, 220, 224, 0.3)',
    secondary: 'rgba(232, 238, 242, 0.2)',
    focus: '#0052FF',
  },
  interactive: {
    hover: '#F5F8FA',
    active: '#E8EEF2',
    disabled: '#F5F8FA',
  },
};

// ============================================
// TEMA OSCURO
// ============================================
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
    primary: 'rgba(43, 49, 57, 0.4)',
    secondary: 'rgba(30, 35, 41, 0.3)',
    focus: '#3B82F6',
  },
  interactive: {
    hover: '#1E2329',
    active: '#2B3139',
    disabled: '#1E2329',
  },
};

// ============================================
// TEMA BITFLOW (marca - azules vibrantes)
// ============================================
const bitflowColors = {
  background: {
    primary: '#0A0F1E',
    secondary: '#0F172A',
    tertiary: '#1E293B',
    elevated: '#1E293B',
  },
  text: {
    primary: '#F1F5F9',
    secondary: '#CBD5E1',
    tertiary: '#94A3B8',
    disabled: '#64748B',
    inverse: '#0A0F1E',
  },
  brand: {
    primary: '#0052FF',
    secondary: '#0066FF',
    tertiary: '#001A4D',
  },
  semantic: {
    success: '#00E5B8',
    successBg: '#003D32',
    error: '#FF5370',
    errorBg: '#4D1F26',
    warning: '#FFB800',
    warningBg: '#4D3800',
    info: '#00B8FF',
    infoBg: '#003A4D',
  },
  trading: {
    buy: '#00E5B8',
    buyHover: '#00D1A6',
    buyBg: '#003D32',
    sell: '#FF5370',
    sellHover: '#E64860',
    sellBg: '#4D1F26',
  },
  border: {
    primary: 'rgba(51, 65, 85, 0.4)',
    secondary: 'rgba(30, 41, 59, 0.3)',
    focus: '#0052FF',
  },
  interactive: {
    hover: '#1E293B',
    active: '#334155',
    disabled: '#0F172A',
  },
};

// ============================================
// FUNCIÓN HELPER: Aplanar colores para uso directo
// ============================================
const flattenColors = (colors) => {
  return {
    // Backgrounds
    background: colors.background.primary,
    backgroundSecondary: colors.background.secondary,
    backgroundTertiary: colors.background.tertiary,
    backgroundElevated: colors.background.elevated,
    backgroundCard: colors.background.elevated,
    
    // Text
    textPrimary: colors.text.primary,
    textSecondary: colors.text.secondary,
    textTertiary: colors.text.tertiary,
    textMuted: colors.text.tertiary,
    textDisabled: colors.text.disabled,
    textInverse: colors.text.inverse,
    
    // Brand
    brandPrimary: colors.brand.primary,
    brandSecondary: colors.brand.secondary,
    brandTertiary: colors.brand.tertiary,
    
    // Semantic (backward compatible)
    success: colors.semantic.success,
    successBg: colors.semantic.successBg,
    danger: colors.semantic.error, // Alias
    error: colors.semantic.error,
    errorBg: colors.semantic.errorBg,
    warning: colors.semantic.warning,
    warningBg: colors.semantic.warningBg,
    info: colors.semantic.info,
    infoBg: colors.semantic.infoBg,
    
    // Trading
    buy: colors.trading.buy,
    buyHover: colors.trading.buyHover,
    buyBg: colors.trading.buyBg,
    sell: colors.trading.sell,
    sellHover: colors.trading.sellHover,
    sellBg: colors.trading.sellBg,
    
    // Borders
    border: colors.border.primary,
    borderSecondary: colors.border.secondary,
    borderHover: colors.border.focus, // Alias
    borderFocus: colors.border.focus,
    
    // Interactive
    interactiveHover: colors.interactive.hover,
    interactiveActive: colors.interactive.active,
    interactiveDisabled: colors.interactive.disabled,
  };
};

// ============================================
// EXPORTAR TEMAS
// ============================================
export const themes = {
  light: flattenColors(lightColors),
  dark: flattenColors(darkColors),
  bitflow: flattenColors(bitflowColors),
};

// ============================================
// SPACING (más generoso, como web)
// ============================================
export const spacing = {
  xs: 6,   // 0.375rem
  sm: 12,  // 0.75rem
  md: 20,  // 1.25rem
  lg: 32,  // 2rem
  xl: 40,  // 2.5rem
  xxl: 64, // 4rem
};

// ============================================
// BORDER RADIUS (como web)
// ============================================
export const borderRadius = {
  sm: 6,   // 0.375rem
  md: 10,  // 0.625rem
  lg: 16,  // 1rem
  xl: 20,  // 1.25rem
  full: 9999,
};

// ============================================
// SHADOWS (como web)
// ============================================
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 9,
  },
};

// ============================================
// FONT SIZES (como web)
// ============================================
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 15,  // ⭐ 15px como en el web
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// ============================================
// COLORES ESTRUCTURADOS (para casos avanzados)
// ============================================
export const structuredColors = {
  light: lightColors,
  dark: darkColors,
  bitflow: bitflowColors,
};