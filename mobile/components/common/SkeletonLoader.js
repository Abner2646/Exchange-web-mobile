// mobile/components/common/SkeletonLoader.js
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, borderRadius } from '../../constants/theme';

export default function SkeletonLoader({ 
  width = '100%', 
  height = 20, 
  style,
  borderRadius: customRadius,
}) {
  const { theme } = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          backgroundColor: theme.backgroundSecondary,
          borderRadius: customRadius ?? borderRadius.md,
          opacity,
        },
        style,
      ]}
    />
  );
}

// Componentes de skeleton predefinidos
export function BalanceCardSkeleton() {
  const { theme } = useTheme();
  
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElevated }]}>
      <View style={styles.balanceHeader}>
        <SkeletonLoader width={120} height={16} style={{ marginBottom: spacing.xs }} />
        <SkeletonLoader width={200} height={40} style={{ marginBottom: spacing.xs }} />
        <SkeletonLoader width={150} height={14} />
      </View>
      
      <View style={styles.actionsGrid}>
        <View style={styles.actionsRow}>
          <SkeletonLoader width="48%" height={48} style={{ marginRight: spacing.xs }} />
          <SkeletonLoader width="48%" height={48} style={{ marginLeft: spacing.xs }} />
        </View>
        <View style={styles.actionsRow}>
          <SkeletonLoader width="48%" height={48} style={{ marginRight: spacing.xs }} />
          <SkeletonLoader width="48%" height={48} style={{ marginLeft: spacing.xs }} />
        </View>
      </View>
    </View>
  );
}

export function TopAssetsSkeleton() {
  const { theme } = useTheme();
  
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElevated }]}>
      <SkeletonLoader width={180} height={20} style={{ marginBottom: spacing.md }} />
      {[1, 2, 3].map((i) => (
        <View key={i} style={{ marginBottom: spacing.md }}>
          <View style={styles.assetRow}>
            <SkeletonLoader width={60} height={16} />
            <SkeletonLoader width={50} height={16} />
          </View>
          <SkeletonLoader width="100%" height={8} style={{ marginVertical: spacing.xs }} />
          <SkeletonLoader width={80} height={14} />
        </View>
      ))}
    </View>
  );
}

export function MarketItemSkeleton() {
  return (
    <View style={styles.marketItem}>
      <SkeletonLoader width={36} height={36} borderRadius={borderRadius.full} />
      <View style={{ flex: 1, marginLeft: spacing.sm }}>
        <SkeletonLoader width={60} height={16} style={{ marginBottom: spacing.xs }} />
        <SkeletonLoader width={100} height={12} />
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <SkeletonLoader width={80} height={16} style={{ marginBottom: spacing.xs }} />
        <SkeletonLoader width={60} height={14} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  card: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  balanceHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  actionsGrid: {
    gap: spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  assetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  marketItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});