// src/context/theme.config.js

// TEMA CLARO (basado en Coinbase)
const lightColors = {
  background: {
    primary: "#FFFFFF",
    secondary: "#F5F8FA",
    tertiary: "#E8EEF2",
    elevated: "#FFFFFF",
  },
  text: {
    primary: "#050F19",
    secondary: "#5B616E",
    tertiary: "#8C919A",
    disabled: "#B8BBBF",
    inverse: "#FFFFFF",
  },
  brand: {
    primary: "#0052FF",
    secondary: "#1652F0",
    tertiary: "#E7F0FF",
  },
  semantic: {
    success: "#05B169",
    successBg: "#E6F5F0",
    error: "#DF5F67",
    errorBg: "#FBECED",
    warning: "#F4B944",
    warningBg: "#FFF8E6",
    info: "#0052FF",
    infoBg: "#E7F0FF",
  },
  trading: {
    buy: "#05B169",
    buyHover: "#049D5B",
    buyBg: "#E6F5F0",
    sell: "#DF5F67",
    sellHover: "#C9545B",
    sellBg: "#FBECED",
  },
  border: {
    primary: "rgba(216, 220, 224, 0.3)", // Más sutil
    secondary: "rgba(232, 238, 242, 0.2)", // Más sutil
    focus: "#0052FF",
  },
  interactive: {
    hover: "#F5F8FA",
    active: "#E8EEF2",
    disabled: "#F5F8FA",
  },
  chart: {
    grid: "#E8EEF2",
    line: "#0052FF",
    area: "rgba(0, 82, 255, 0.1)",
    candle: {
      up: "#05B169",
      down: "#DF5F67",
    },
  },
}

// TEMA OSCURO
const darkColors = {
  background: {
    primary: "#0A0E13",
    secondary: "#141A20",
    tertiary: "#1E2329",
    elevated: "#1E2329",
  },
  text: {
    primary: "#EAECEF",
    secondary: "#B7BDC6",
    tertiary: "#848E9C",
    disabled: "#5E6673",
    inverse: "#0A0E13",
  },
  brand: {
    primary: "#3B82F6",
    secondary: "#2563EB",
    tertiary: "#1E3A8A",
  },
  semantic: {
    success: "#10B981",
    successBg: "#064E3B",
    error: "#EF4444",
    errorBg: "#7F1D1D",
    warning: "#F59E0B",
    warningBg: "#78350F",
    info: "#3B82F6",
    infoBg: "#1E3A8A",
  },
  trading: {
    buy: "#10B981",
    buyHover: "#059669",
    buyBg: "#064E3B",
    sell: "#EF4444",
    sellHover: "#DC2626",
    sellBg: "#7F1D1D",
  },
  border: {
    primary: "rgba(43, 49, 57, 0.4)", // Más sutil
    secondary: "rgba(30, 35, 41, 0.3)", // Más sutil
    focus: "#3B82F6",
  },
  interactive: {
    hover: "#1E2329",
    active: "#2B3139",
    disabled: "#1E2329",
  },
  chart: {
    grid: "#2B3139",
    line: "#3B82F6",
    area: "rgba(59, 130, 246, 0.1)",
    candle: {
      up: "#10B981",
      down: "#EF4444",
    },
  },
}

// TEMA CRYPTO (colores azules vibrantes de marca)
const bitflowColors = {
  background: {
    primary: "#0A0F1E", // Azul muy oscuro, casi negro
    secondary: "#0F172A", // Azul oscuro slate
    tertiary: "#1E293B", // Azul grisáceo oscuro
    elevated: "#1E293B", // Elevado = tertiary para consistencia
  },
  text: {
    primary: "#F1F5F9", // Blanco azulado muy claro
    secondary: "#CBD5E1", // Gris azulado claro
    tertiary: "#94A3B8", // Gris azulado medio
    disabled: "#64748B", // Gris azulado apagado
    inverse: "#0A0F1E", // Inverso = background primary
  },
  brand: {
    primary: "#0052FF", // Azul principal de la marca
    secondary: "#0066FF", // Azul más brillante
    tertiary: "#001A4D", // Azul muy oscuro para fondos
  },
  semantic: {
    success: "#00E5B8", // Verde cyan brillante crypto
    successBg: "#003D32",
    error: "#FF5370", // Rojo rosado vibrante
    errorBg: "#4D1F26",
    warning: "#FFB800", // Amarillo dorado
    warningBg: "#4D3800",
    info: "#00B8FF", // Azul cyan brillante
    infoBg: "#003A4D",
  },
  trading: {
    buy: "#00E5B8", // Verde cyan para comprar
    buyHover: "#00D1A6",
    buyBg: "#003D32",
    sell: "#FF5370", // Rojo rosado para vender
    sellHover: "#E64860",
    sellBg: "#4D1F26",
  },
  border: {
    primary: "rgba(51, 65, 85, 0.4)", // Más sutil
    secondary: "rgba(30, 41, 59, 0.3)", // Más sutil
    focus: "#0052FF", // Focus = brand primary
  },
  interactive: {
    hover: "#1E293B", // Hover = background tertiary
    active: "#334155", // Active = border primary
    disabled: "#0F172A", // Disabled = background secondary
  },
  chart: {
    grid: "#1E293B", // Grid sutil
    line: "#0052FF", // Línea = brand primary
    area: "rgba(0, 82, 255, 0.15)", // Área azul translúcida
    candle: {
      up: "#00E5B8", // Vela alcista = verde cyan
      down: "#FF5370", // Vela bajista = rojo rosado
    },
  },
}

// Configuración común para todos los temas
const commonConfig = {
  spacing: {
    xs: "0.375rem", // 6px (antes 4px)
    sm: "0.75rem", // 12px (antes 8px)
    md: "1.25rem", // 20px (antes 16px)
    lg: "2rem", // 32px (antes 24px)
    xl: "2.5rem", // 40px (antes 32px)
    xxl: "4rem", // 64px (antes 48px)
  },
  borderRadius: {
    sm: "0.375rem", // 6px (antes 4px)
    md: "0.625rem", // 10px (antes 8px)
    lg: "1rem", // 16px (antes 12px)
    xl: "1.25rem", // 20px (nuevo)
    full: "9999px",
  },
  shadows: {
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
    md: "0 2px 8px 0 rgba(0, 0, 0, 0.08)",
    lg: "0 4px 16px 0 rgba(0, 0, 0, 0.12)",
    xl: "0 8px 24px 0 rgba(0, 0, 0, 0.15)",
  },
}

export const themes = {
  light: {
    mode: "light",
    colors: lightColors,
    ...commonConfig,
  },
  dark: {
    mode: "dark",
    colors: darkColors,
    ...commonConfig,
  },
  bitflow: {
    mode: "bitflow",
    colors: bitflowColors,
    ...commonConfig,
  },
}
