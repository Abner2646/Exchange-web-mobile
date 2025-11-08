// mobile/app/(tabs)/profile.js
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { spacing, fontSize, borderRadius } from '../../constants/theme';
import ThemeSwitcher from '../../components/profile/ThemeSwitcher';
import Button from '../../components/ui/Button';

export default function Profile() {
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro que deseas salir?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          Perfil
        </Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Info del usuario */}
        <View style={[styles.userCard, { backgroundColor: theme.backgroundCard }]}>
          <View style={[styles.avatar, { backgroundColor: theme.success }]}>
            <Text style={styles.avatarText}>
              {user?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={[styles.username, { color: theme.textPrimary }]}>
            {user?.username || 'Usuario'}
          </Text>
          <Text style={[styles.email, { color: theme.textSecondary }]}>
            {user?.email}
          </Text>
          {user?.emailVerificado && (
            <View style={[styles.verifiedBadge, { backgroundColor: theme.success }]}>
              <Text style={styles.verifiedText}>✓ Verificado</Text>
            </View>
          )}
        </View>

        {/* Theme Switcher */}
        <ThemeSwitcher />

        {/* Opciones adicionales */}
        <View style={[styles.section, { backgroundColor: theme.backgroundCard }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Cuenta
          </Text>
          
          <TouchableOpacity 
            style={styles.option}
            onPress={() => router.push('/configuracion')}
          >
            <Text style={[styles.optionText, { color: theme.textPrimary }]}>
              ⚙️ Configuración
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.option}
            onPress={() => router.push('/seguridad')}
          >
            <Text style={[styles.optionText, { color: theme.textPrimary }]}>
              🔐 Seguridad
            </Text>
          </TouchableOpacity>
        </View>

        {/* Botón de logout */}
        <Button 
          variant="danger" 
          onPress={handleLogout}
          style={styles.logoutButton}
        >
          Cerrar sesión
        </Button>

        {/* Versión de la app */}
        <Text style={[styles.version, { color: theme.textMuted }]}>
          Versión 1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
  },
  content: {
    padding: spacing.md,
  },
  userCard: {
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: fontSize.xxxl,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  username: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: fontSize.base,
    marginBottom: spacing.sm,
  },
  verifiedBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  verifiedText: {
    color: '#ffffff',
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  section: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.base,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  option: {
    paddingVertical: spacing.md,
  },
  optionText: {
    fontSize: fontSize.base,
  },
  logoutButton: {
    marginBottom: spacing.xl,
  },
  version: {
    textAlign: 'center',
    fontSize: fontSize.xs,
    marginBottom: spacing.lg,
  },
});