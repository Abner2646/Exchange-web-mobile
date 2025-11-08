// mobile/components/profile/ThemeSwitcher.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../constants/theme';
import Card from '../ui/Card';

export default function ThemeSwitcher() {
  const { theme, currentTheme, switchTheme } = useTheme();

  const themeOptions = [
    { 
      id: 'light', 
      name: 'Claro', 
      icon: '☀️',
      description: 'Estilo Coinbase',
    },
    { 
      id: 'dark', 
      name: 'Oscuro', 
      icon: '🌙',
      description: 'Suave para tus ojos',
    },
    { 
      id: 'bitflow',
      name: 'BitFlow', 
      icon: '⚡',
      description: 'Marca premium',
    },
  ];

  return (
    <Card style={styles.card}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>
        Tema de la aplicación
      </Text>

      <View style={styles.themesContainer}>
        {themeOptions.map((themeOption) => {
          const isActive = currentTheme === themeOption.id;
          
          return (
            <TouchableOpacity
              key={themeOption.id}
              style={[
                styles.themeButton,
                { 
                  backgroundColor: theme.backgroundElevated,
                  borderColor: isActive ? theme.brandPrimary : theme.border, // ⭐ CAMBIO
                  borderWidth: 2,
                },
              ]}
              onPress={() => switchTheme(themeOption.id)}
              activeOpacity={0.7}
            >
              {/* Icono */}
              <Text style={styles.icon}>{themeOption.icon}</Text>
              
              {/* Nombre */}
              <Text style={[
                styles.themeName, 
                { color: isActive ? theme.brandPrimary : theme.textPrimary } // ⭐ CAMBIO
              ]}>
                {themeOption.name}
              </Text>
              
              {/* Descripción */}
              <Text style={[styles.description, { color: theme.textMuted }]}>
                {themeOption.description}
              </Text>

              {/* Checkmark si está activo */}
              {isActive && (
                <View style={[styles.checkmark, { backgroundColor: theme.brandPrimary }]}> {/* ⭐ CAMBIO */}
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  themesContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  themeButton: {
    flex: 1,
    minWidth: '30%',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minHeight: 100,
  },
  icon: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  themeName: {
    fontSize: fontSize.base,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  checkmark: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});