import React from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, borderRadius, fontSize } from '../../constants/theme';

export default function Input({ style, ...props }) {
  const { theme } = useTheme();

  return (
    <TextInput
      style={[
        styles.input,
        {
          backgroundColor: theme.backgroundElevated,
          borderColor: theme.border,
          color: theme.textPrimary,
        },
        style,
      ]}
      placeholderTextColor={theme.textMuted}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    fontSize: fontSize.base,
    borderWidth: 1,
  },
});