import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize } from '../../constants/theme';
import Card from '../../components/ui/Card';

export default function Assets() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [balances] = useState([
    { id: '1', crypto: 'BTC', amount: '0.00', usdValue: '$0.00' },
    { id: '2', crypto: 'ETH', amount: '0.00', usdValue: '$0.00' },
    { id: '3', crypto: 'USDT', amount: '0.00', usdValue: '$0.00' },
  ]);

  const renderBalance = ({ item }) => (
    <Card style={styles.balanceCard}>
      <View style={styles.balanceRow}>
        <View>
          <Text style={[styles.crypto, { color: theme.textPrimary }]}>
            {item.crypto}
          </Text>
          <Text style={[styles.amount, { color: theme.textSecondary }]}>
            {item.amount}
          </Text>
        </View>
        <Text style={[styles.usdValue, { color: theme.textPrimary }]}>
          {item.usdValue}
        </Text>
      </View>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          Mis Activos
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.success} />
      ) : (
        <FlatList
          data={balances}
          renderItem={renderBalance}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: spacing.md,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: 'bold',
  },
  list: {
    padding: spacing.md,
    paddingTop: 0,
  },
  balanceCard: {
    marginBottom: spacing.sm,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  crypto: {
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  amount: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  usdValue: {
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
});