// mobile/app/register.js
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
import { useRegisterFlow } from '../hooks/useRegisterFlow';
import { useTheme } from '../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../constants/theme';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

export default function Register() {
  const { theme } = useTheme();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { loginWithGoogle } = useAuth();
  const {
    formData,
    validationErrors,
    isRegistering,
    handleChange,
    register,
  } = useRegisterFlow();

  const handleGoogleRegister = async () => {
    if (isRegistering) return;
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error('Error en registro con Google:', error);
    }
  };

  const handleSubmit = () => {
    register();
  };

  const handleLogin = () => {
    router.push('/login');
  };

  const isFormValid =
    formData.email.trim().length > 0 &&
    formData.username.trim().length >= 3 &&
    formData.password.length >= 6 &&
    formData.confirmPassword.length >= 6 &&
    formData.password === formData.confirmPassword;

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
              Crear Cuenta
            </Text>
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              Únete a la plataforma de trading
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.googleButton,
              {
                backgroundColor: theme.backgroundElevated,
                borderColor: theme.border,
              },
              isRegistering && styles.disabledButton,
              pressed && !isRegistering && styles.pressedButton,
            ]}
            onPress={handleGoogleRegister}
            disabled={isRegistering}
          >
            <Ionicons name="logo-google" size={20} color="#DB4437" />
            <Text style={[styles.googleButtonText, { color: theme.textPrimary }]}>
              Registrarse con Google
            </Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <Text style={[styles.dividerText, { color: theme.textMuted }]}>
              o regístrate con email
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          <View style={styles.form}>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.textPrimary }]}>
                Email
              </Text>
              <Input
                placeholder="tu@email.com"
                value={formData.email}
                onChangeText={(value) => handleChange('email', value)}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!isRegistering}
                autoComplete="email"
                textContentType="emailAddress"
              />
              {validationErrors.email && (
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {validationErrors.email}
                </Text>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.textPrimary }]}>
                Usuario
              </Text>
              <Input
                placeholder="Elige tu nombre de usuario"
                value={formData.username}
                onChangeText={(value) => handleChange('username', value)}
                autoCapitalize="none"
                editable={!isRegistering}
                autoComplete="username"
                textContentType="username"
              />
              {validationErrors.username && (
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {validationErrors.username}
                </Text>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.textPrimary }]}>
                Contraseña
              </Text>
              <View style={styles.inputWrapper}>
                <Input
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChangeText={(value) => handleChange('password', value)}
                  secureTextEntry={!showPassword}
                  editable={!isRegistering}
                  style={styles.inputWithIcon}
                  autoComplete="password-new"
                  textContentType="newPassword"
                />
                <TouchableOpacity
                  style={styles.inputIcon}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={isRegistering}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color={theme.textMuted}
                  />
                </TouchableOpacity>
              </View>
              {validationErrors.password && (
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {validationErrors.password}
                </Text>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.textPrimary }]}>
                Confirmar Contraseña
              </Text>
              <View style={styles.inputWrapper}>
                <Input
                  placeholder="Repite tu contraseña"
                  value={formData.confirmPassword}
                  onChangeText={(value) => handleChange('confirmPassword', value)}
                  secureTextEntry={!showConfirmPassword}
                  editable={!isRegistering}
                  style={styles.inputWithIcon}
                  autoComplete="password-new"
                  textContentType="newPassword"
                />
                <TouchableOpacity
                  style={styles.inputIcon}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isRegistering}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color={theme.textMuted}
                  />
                </TouchableOpacity>
              </View>
              {validationErrors.confirmPassword && (
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {validationErrors.confirmPassword}
                </Text>
              )}
            </View>

            <Button
              variant="primary"
              onPress={handleSubmit}
              loading={isRegistering}
              disabled={!isFormValid || isRegistering}
              style={styles.submitButton}
            >
              Crear Cuenta
            </Button>

            <Text style={[styles.termsText, { color: theme.textMuted }]}>
              Al registrarte, aceptas nuestros{' '}
              <Text style={[styles.termsLink, { color: theme.info }]}>
                términos y condiciones
              </Text>
            </Text>
          </View>
        </Card>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            ¿Ya tienes cuenta?{' '}
            <Text
              style={[styles.loginLink, { color: theme.info }]}
              onPress={handleLogin}
            >
              Inicia Sesión
            </Text>
          </Text>
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
  errorText: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  submitButton: {
    marginTop: spacing.sm,
  },
  termsText: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    fontWeight: '600',
  },
  footer: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    fontSize: fontSize.sm,
  },
  loginLink: {
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  pressedButton: {
    opacity: 0.7,
  },
});