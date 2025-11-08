// mobile/app/forgot-password.js
import React, { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../constants/theme';
import { useForgotPasswordFlow } from '../hooks/useForgotPasswordFlow';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

export default function ForgotPassword() {
  const { theme } = useTheme();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    email,
    setEmail,
    codigo,
    setCodigo,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    step,
    requestCode,
    resendCode,
    resetPassword,
    isRequestingCode,
    isResending,
    isResetting,
  } = useForgotPasswordFlow();

  const loading = isRequestingCode || isResending || isResetting;

  const handleSubmit = async () => {
    if (step === 1) {
      await requestCode();
    } else {
      const success = await resetPassword();
      if (success) {
        router.replace('/login');
      }
    }
  };

  const handleBack = () => {
    router.back();
  };

  const isFormValid = step === 1
    ? email.trim().length > 0
    : codigo.length === 6 && newPassword.length >= 6 && newPassword === confirmPassword;

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
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          disabled={loading}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {step === 1 ? 'Recuperar Contraseña' : 'Nueva Contraseña'}
          </Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {step === 1
              ? 'Ingresa tu email y te enviaremos un código de verificación'
              : 'Ingresa el código y tu nueva contraseña'}
          </Text>
        </View>

        <Card style={styles.card}>
          <View style={styles.form}>
            {step === 1 ? (
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>
                  Email
                </Text>
                <Input
                  placeholder="ejemplo@email.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                  autoComplete="email"
                  textContentType="emailAddress"
                  autoFocus
                />
              </View>
            ) : (
              <>
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
                    editable={!loading}
                    style={styles.codeInput}
                    autoFocus
                  />

                  <View style={styles.resendContainer}>
                    <Text style={[styles.resendHint, { color: theme.textMuted }]}>
                      ¿No recibiste el código?
                    </Text>
                    <TouchableOpacity
                      style={styles.resendButton}
                      onPress={resendCode}
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

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: theme.textPrimary }]}>
                    Nueva contraseña
                  </Text>
                  <View style={styles.inputWrapper}>
                    <Input
                      placeholder="Mínimo 6 caracteres"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showPassword}
                      editable={!loading}
                      style={styles.inputWithIcon}
                      autoComplete="password-new"
                      textContentType="newPassword"
                    />
                    <TouchableOpacity
                      style={styles.inputIcon}
                      onPress={() => setShowPassword(!showPassword)}
                      disabled={loading}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color={theme.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: theme.textPrimary }]}>
                    Confirmar contraseña
                  </Text>
                  <View style={styles.inputWrapper}>
                    <Input
                      placeholder="Repite tu contraseña"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      editable={!loading}
                      style={styles.inputWithIcon}
                      autoComplete="password-new"
                      textContentType="newPassword"
                    />
                    <TouchableOpacity
                      style={styles.inputIcon}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={loading}
                    >
                      <Ionicons
                        name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color={theme.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            <Button
              variant="primary"
              onPress={handleSubmit}
              loading={loading}
              disabled={!isFormValid || loading}
              style={styles.submitButton}
            >
              {step === 1 ? 'Enviar código' : 'Cambiar contraseña'}
            </Button>
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
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: spacing.sm,
    marginBottom: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: 'bold',
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: fontSize.base,
    lineHeight: 22,
  },
  card: {
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
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
});