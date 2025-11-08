// mobile/app/login.js
import React, { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useLoginFlow } from '../hooks/useLoginFlow';
import { useTheme } from '../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../constants/theme';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

export default function Login() {
  const { theme } = useTheme();
  const router = useRouter();

  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [codigo2FA, setCodigo2FA] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

  const loading = isLoggingIn || isVerifying || isResending;

  const handleGoogleLogin = async () => {
    if (loading) return;
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error('Error en login con Google:', error);
    }
  };

  const handleSubmit = () => {
    if (!requires2FA) {
      if (!emailOrUsername.trim()) return;
      if (!password || password.length < 6) return;
      loginWithCredentials({ emailOrUsername: emailOrUsername.trim(), password });
    } else {
      if (codigo2FA.length !== 6) return;
      verify2FA(codigo2FA);
    }
  };

  const handleResend2FA = () => {
    if (!loading) {
      resend2FA();
    }
  };

  const handleResetToLogin = () => {
    resetToLogin();
    setCodigo2FA('');
  };

  const handleForgotPassword = () => {
    router.push('/forgot-password');
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const isFormValid = !requires2FA
    ? emailOrUsername.trim().length >= 3 && password.length >= 6
    : codigo2FA.length === 6;

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
        <View style={styles.logoContainer}>
          <Text style={[styles.appName, { color: theme.info }]}>
            BitFlow
          </Text>
          <Text style={[styles.tagline, { color: theme.textSecondary }]}>
            Tu exchange de confianza
          </Text>
        </View>

        <Card style={styles.card}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>
              {requires2FA ? 'Verificación 2FA' : 'Iniciar Sesión'}
            </Text>
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              {requires2FA
                ? 'Ingresa el código de 6 dígitos enviado a tu email'
                : 'Accede a tu cuenta de trading'}
            </Text>
          </View>

          {!requires2FA && (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.googleButton,
                  {
                    backgroundColor: theme.backgroundElevated,
                    borderColor: theme.border,
                  },
                  loading && styles.disabledButton,
                  pressed && !loading && styles.pressedButton,
                ]}
                onPress={handleGoogleLogin}
                disabled={loading}
              >
                <Ionicons name="logo-google" size={20} color="#DB4437" />
                <Text style={[styles.googleButtonText, { color: theme.textPrimary }]}>
                  Continuar con Google
                </Text>
              </Pressable>

              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                <Text style={[styles.dividerText, { color: theme.textMuted }]}>
                  o continúa con email
                </Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              </View>
            </>
          )}

          <View style={styles.form}>
            {!requires2FA ? (
              <>
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: theme.textPrimary }]}>
                    Email o Usuario
                  </Text>
                  <Input
                    placeholder="ejemplo@email.com"
                    value={emailOrUsername}
                    onChangeText={setEmailOrUsername}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!loading}
                    autoComplete="email"
                    textContentType="emailAddress"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: theme.textPrimary }]}>
                    Contraseña
                  </Text>
                  <View style={styles.inputWrapper}>
                    <Input
                      placeholder="Ingresa tu contraseña"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      editable={!loading}
                      style={styles.inputWithIcon}
                      autoComplete="password"
                      textContentType="password"
                    />
                    <TouchableOpacity
                      style={styles.inputIcon}
                      onPress={togglePasswordVisibility}
                      disabled={loading}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color={theme.textMuted}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.forgotPasswordWrapper}>
                    <TouchableOpacity
                      style={styles.forgotPasswordButton}
                      onPress={handleForgotPassword}
                      disabled={loading}
                    >
                      <Text
                        style={[
                          styles.forgotPasswordText,
                          { color: theme.info },
                        ]}
                      >
                        ¿Olvidaste tu contraseña?
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>
                  Código de verificación
                </Text>
                <Input
                  placeholder="000000"
                  value={codigo2FA}
                  onChangeText={(value) => {
                    const numericValue = value.replace(/\D/g, '').slice(0, 6);
                    setCodigo2FA(numericValue);
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  editable={!loading}
                  style={styles.codeInput}
                />

                <View style={styles.resendContainer}>
                  <Text style={[styles.resendHint, { color: theme.textMuted }]}>
                    ¿No recibiste el código?
                  </Text>
                  <TouchableOpacity
                    style={styles.resendButton}
                    onPress={handleResend2FA}
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
              </View>
            )}

            <Button
              variant="primary"
              onPress={handleSubmit}
              loading={loading}
              disabled={!isFormValid || loading}
              style={styles.submitButton}
            >
              {requires2FA ? 'Verificar código' : 'Iniciar Sesión'}
            </Button>

            {requires2FA && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleResetToLogin}
                disabled={loading}
              >
                <Ionicons
                  name="arrow-back-outline"
                  size={16}
                  color={theme.textMuted}
                />
                <Text
                  style={[styles.backButtonText, { color: theme.textMuted }]}
                >
                  Volver al inicio de sesión
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        
        {!requires2FA && (
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              ¿No tienes una cuenta?{' '}
              <Text 
                style={[styles.registerLink, { color: theme.info }]}
                onPress={() => router.push('/register')}
              >
                Regístrate
              </Text>
            </Text>
          </View>
        )}
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
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  appName: {
    fontSize: 48,
    fontWeight: 'bold',
    letterSpacing: -1,
    marginBottom: spacing.xs,
  },
  tagline: {
    fontSize: fontSize.sm,
    letterSpacing: 0.5,
  },
  card: {
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: spacing.lg,
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
    lineHeight: 20,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
    minHeight: 48,
  },
  googleButtonText: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: fontSize.xs,
    paddingHorizontal: spacing.sm,
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
  },
  inputWrapper: {
    position: 'relative',
  },
  inputWithIcon: {
    paddingRight: 44,
  },
  inputIcon: {
    position: 'absolute',
    right: spacing.md,
    top: '50%',
    transform: [{ translateY: -10 }],
    padding: spacing.xs,
  },
  forgotPasswordWrapper: {
    marginTop: spacing.xs,
    alignItems: 'flex-end',
  },
  forgotPasswordButton: {
    padding: spacing.xs,
  },
  forgotPasswordText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  codeInput: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 8,
  },
  resendContainer: {
    marginTop: spacing.md,
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  backButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  footer: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    fontSize: fontSize.sm,
  },
  registerLink: {
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  pressedButton: {
    opacity: 0.7,
  },
});