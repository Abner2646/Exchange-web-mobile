import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, borderRadius, shadows } from '../../constants/theme';

export default function Card({ children, style, elevated = true }) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundCard,
          borderColor: theme.border,
        },
        elevated && shadows.sm,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
  },
});