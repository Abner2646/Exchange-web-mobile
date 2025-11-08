// mobile/app/verify-email.js
import React, { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../constants/theme';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import authService from '../services/authService';

export default function VerifyEmail() {
  const { theme } = useTheme();
  const router = useRouter();
  const { user, updateUser } = useAuth();

  const [codigo, setCodigo] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleVerify = async () => {
    if (codigo.length !== 6) {
      Alert.alert('Error', 'El código debe tener 6 dígitos');
      return;
    }

    setIsVerifying(true);
    try {
      await authService.verifyEmail(codigo);
      
      updateUser({ emailVerificado: true });
      
      Alert.alert(
        'Email verificado',
        'Tu cuenta ha sido verificada exitosamente.',
        [
          {
            text: 'Continuar',
            onPress: () => router.replace('/(tabs)'),
          },
        ]
      );
    } catch (error) {
      console.error('Error verificando email:', error);
      Alert.alert(
        'Código incorrecto',
        error.response?.data?.error || 'El código ingresado no es válido. Verifica e intenta nuevamente.',
        [{ text: 'Entendido' }]
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      await authService.resendVerificationEmail();
      Alert.alert(
        'Código reenviado',
        'Se ha enviado un nuevo código a tu email.',
        [{ text: 'Entendido' }]
      );
    } catch (error) {
      console.error('Error reenviando código:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'No se pudo reenviar el código.',
        [{ text: 'Entendido' }]
      );
    } finally {
      setIsResending(false);
    }
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  const loading = isVerifying || isResending;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: theme.info }]}>
            <Ionicons name="mail-outline" size={48} color="#FFFFFF" />
          </View>
        </View>

        <Card style={styles.card}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>
              Verifica tu Email
            </Text>
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              Hemos enviado un código de verificación a
            </Text>
            <Text style={[styles.email, { color: theme.textPrimary }]}>
              {user?.email}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.textPrimary }]}>
                Código de verificación
              </Text>
              <Input
                placeholder="000000"
                value={codigo}
                onChangeText={(value) => {
                  const numericValue = value.replace(/\D/g, '').slice(0, 6);
                  setCodigo(numericValue);
                }}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                editable={!loading}
                style={styles.codeInput}
              />
            </View>

            <View style={styles.resendContainer}>
              <Text style={[styles.resendHint, { color: theme.textMuted }]}>
                ¿No recibiste el código?
              </Text>
              <TouchableOpacity
                style={styles.resendButton}
                onPress={handleResend}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.resendText,
                    { color: loading ? theme.textMuted : theme.info },
                  ]}
                >
                  {isResending ? 'Reenviando...' : 'Reenviar código'}
                </Text>
              </TouchableOpacity>
            </View>

            <Button
              variant="primary"
              onPress={handleVerify}
              loading={isVerifying}
              disabled={codigo.length !== 6 || loading}
              style={styles.submitButton}
            >
              Verificar Email
            </Button>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
              disabled={loading}
            >
              <Text
                style={[styles.skipButtonText, { color: theme.textMuted }]}
              >
                Verificar más tarde
              </Text>
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: fontSize.base,
    fontWeight: '600',
    textAlign: 'center',
  },
  form: {
    gap: spacing.md,
  },
  formGroup: {
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  codeInput: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 8,
  },
  resendContainer: {
    marginTop: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  resendHint: {
    fontSize: fontSize.xs,
  },
  resendButton: {
    padding: spacing.xs,
  },
  resendText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  submitButton: {
    marginTop: spacing.sm,
  },
  skipButton: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  skipButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
});