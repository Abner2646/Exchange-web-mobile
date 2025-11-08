// mobile/app/auth-success.js
import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { spacing, fontSize } from '../constants/theme';
import authService from '../services/authService';

export default function AuthSuccess() {
  const { theme } = useTheme();
  const router = useRouter();
  const { login } = useAuth();
  const params = useLocalSearchParams();

  useEffect(() => {
    handleAuthCallback();
  }, []);

  const handleAuthCallback = async () => {
    try {
      const token = params.token;
      const isNewUser = params.new === 'true';

      if (!token) {
        console.error('No se recibió token');
        router.replace('/login');
        return;
      }

      await authService.setAuthToken(token);
      const user = authService.getCurrentUser();
      
      await login(user);

      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error en callback de autenticación:', error);
      router.replace('/login');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.success} />
      <Text style={[styles.text, { color: theme.textPrimary }]}>
        Completando autenticación...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  text: {
    fontSize: fontSize.base,
    fontWeight: '500',
  },
});