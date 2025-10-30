import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { spacing, fontSize } from '../../constants/theme';
import Card from '../../components/ui/Card';

export default function Home() {
  const { theme } = useTheme();
  const { user } = useAuth();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          Bienvenido, {user?.username}! 🚀
        </Text>

        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
            Balance Total
          </Text>
          <Text style={[styles.amount, { color: theme.success }]}>
            $0.00 USD
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
            Mercado
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Próximamente...
          </Text>
        </Card>
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
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  amount: {
    fontSize: fontSize.xxxl,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: fontSize.base,
  },
});