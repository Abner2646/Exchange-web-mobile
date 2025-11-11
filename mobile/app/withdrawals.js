// app/withdrawals-paused.js
import React from 'react';
import { View, Text, StyleSheet, Alert, Linking, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { spacing, fontSize } from '../constants/theme';
import Button from '../components/ui/Button';

export default function WithdrawalsPaused() {
  const { theme } = useTheme();

  const handleOpenWeb = async () => {
    const webUrl = 'https://tu-exchange.com/withdraw';
    
    try {
      const canOpen = await Linking.canOpenURL(webUrl);
      if (canOpen) {
        await Linking.openURL(webUrl);
      } else {
        Alert.alert('Error', 'No se puede abrir el enlace en este momento');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo abrir la plataforma web');
    }
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.iconContainer}>
        <Ionicons 
          name="warning-outline" 
          size={80} 
          color={theme.warning} 
        />
      </View>
      
      <Text style={[styles.title, { color: theme.textPrimary }]}>
        Retiros Temporalmente Pausados
      </Text>
      
      <Text style={[styles.description, { color: theme.textSecondary }]}>
        Para realizar retiros en este momento, por favor visita nuestra plataforma web donde esta funcionalidad está disponible.
      </Text>
      
      <Button
        variant="primary"
        onPress={handleOpenWeb}
        style={styles.button}
      >
        Ir a la Plataforma Web
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  iconContainer: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 38,
  },
  description: {
    fontSize: fontSize.base,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xxl,
    maxWidth: 300,
  },
  button: {
    width: '100%',
    maxWidth: 300,
  },
});