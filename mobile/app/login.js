import React, { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useLoginFlow } from '../hooks/useLoginFlow';
import { useTheme } from '../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../constants/theme';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

export default function Login() {
  const { theme } = useTheme();

  // Estado del formulario
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [codigo2FA, setCodigo2FA] = useState('');

  // Hooks
  const { loginWithGoogle } = useAuth();
  const {
    requires2FA,
    loginWithCredentials,
    verify2FA,
    resend2FA,
    resetToLogin,
    isLoggingIn,
    isVerifying,
    isResending,
  } = useLoginFlow();

  // Handlers
  const handleGoogleLogin = () => {
    loginWithGoogle();
  };

  const handleSubmit = () => {
    if (!requires2FA) {
      // Paso 1: Login con credenciales
      loginWithCredentials({ emailOrUsername, password });
    } else {
      // Paso 2: Verificar código 2FA
      verify2FA(codigo2FA);
    }
  };

  const handleResend2FA = () => {
    resend2FA();
  };

  const handleResetToLogin = () => {
    resetToLogin();
    setCodigo2FA('');
  };

  // Estado de carga combinado
  const loading = isLoggingIn || isVerifying || isResending;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { backgroundColor: theme.backgroundCard }]}>
          {/* Título */}
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {requires2FA ? 'Verificación en dos pasos' : 'Iniciar Sesión'}
          </Text>

          {/* Descripción */}
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {requires2FA
              ? 'Ingresa el código de verificación enviado a tu email'
              : 'Accede a tu cuenta de trading'}
          </Text>

          {/* Botón de Google - solo en login inicial */}
          {!requires2FA && (
            <>
              <TouchableOpacity
                style={[
                  styles.googleButton,
                  { 
                    backgroundColor: theme.backgroundElevated,
                    borderColor: theme.border,
                  },
                ]}
                onPress={handleGoogleLogin}
                disabled={loading}
              >
                <Text style={[styles.googleButtonText, { color: theme.textPrimary }]}>
                  🔐 Continuar con Google
                </Text>
              </TouchableOpacity>

              {/* Separador */}
              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                <Text style={[styles.dividerText, { color: theme.textMuted }]}>o</Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              </View>
            </>
          )}

          {/* Formulario */}
          <View style={styles.form}>
            {!requires2FA ? (
              // Campos de login inicial
              <>
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: theme.textPrimary }]}>
                    Email o Usuario *
                  </Text>
                  <Input
                    placeholder="Ingresa tu email o usuario"
                    value={emailOrUsername}
                    onChangeText={setEmailOrUsername}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!loading}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: theme.textPrimary }]}>
                    Contraseña *
                  </Text>
                  <Input
                    placeholder="Ingresa tu contraseña"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    editable={!loading}
                  />
                  <TouchableOpacity style={styles.forgotPassword}>
                    <Text style={[styles.forgotPasswordText, { color: theme.success }]}>
                      ¿Olvidaste tu contraseña?
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              // Campo de código 2FA
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>
                  Código de verificación *
                </Text>
                <Input
                  placeholder="Ingresa el código de 6 dígitos"
                  value={codigo2FA}
                  onChangeText={(text) =>
                    setCodigo2FA(text.replace(/\D/g, '').slice(0, 6))
                  }
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  editable={!loading}
                />
                <View style={styles.resendContainer}>
                  <TouchableOpacity onPress={handleResend2FA} disabled={loading}>
                    <Text
                      style={[
                        styles.resendText,
                        { color: loading ? theme.textMuted : theme.success },
                      ]}
                    >
                      Reenviar código
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Botón Submit */}
            <Button
              variant="success"
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
            >
              {requires2FA ? 'Verificar código' : 'Iniciar Sesión'}
            </Button>

            {/* Botón volver (solo en 2FA) */}
            {requires2FA && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleResetToLogin}
              >
                <Text style={[styles.backButtonText, { color: theme.textMuted }]}>
                  ← Volver al login
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Footer - solo en login inicial */}
          {!requires2FA && (
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: theme.textSecondary }]}>
                ¿No tienes una cuenta?{' '}
                <Text style={{ color: theme.success, fontWeight: '600' }}>
                  Regístrate
                </Text>
              </Text>
            </View>
          )}
        </View>
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
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.xxl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: fontSize.base,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  googleButton: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  googleButtonText: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: spacing.md,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  form: {
    marginTop: spacing.lg,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  forgotPassword: {
    marginTop: spacing.sm,
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  resendContainer: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  resendText: {
    fontSize: fontSize.sm,
    textDecorationLine: 'underline',
  },
  backButton: {
    marginTop: spacing.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: fontSize.sm,
  },
  footer: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    fontSize: fontSize.sm,
  },
});
