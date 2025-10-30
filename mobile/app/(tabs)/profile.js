import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { spacing, fontSize } from '../../constants/theme';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

export default function Profile() {
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          Perfil
        </Text>

        <Card style={styles.card}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Usuario
          </Text>
          <Text style={[styles.value, { color: theme.textPrimary }]}>
            {user?.username}
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Email
          </Text>
          <Text style={[styles.value, { color: theme.textPrimary }]}>
            {user?.email}
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Rol
          </Text>
          <Text style={[styles.value, { color: theme.textPrimary }]}>
            {user?.role}
          </Text>
        </Card>

        <Button variant="danger" onPress={handleLogout}>
          Cerrar Sesión
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: 'bold',
    marginBottom: spacing.lg,
  },
  card: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
});