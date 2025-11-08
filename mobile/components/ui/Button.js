// mobile/components/ui/Button.js
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, borderRadius, fontSize } from '../../constants/theme';

export default function Button({
  children,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}) {
  const { theme } = useTheme();

  const getButtonColor = () => {
    if (disabled) return theme.textMuted;
    switch (variant) {
      case 'primary':
        return theme.info; // ✅ Azul de marca
      case 'success':
        return theme.success; // Verde
      case 'danger':
        return theme.danger; // Rojo
      case 'outline':
        return 'transparent';
      default:
        return theme.info; // ✅ Por defecto azul
    }
  };

  const getTextColor = () => {
    if (variant === 'outline') return theme.textPrimary;
    return '#ffffff';
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: getButtonColor(),
          borderColor: variant === 'outline' ? theme.border : 'transparent',
        },
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <Text style={[styles.text, { color: getTextColor() }]}>{children}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  text: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});