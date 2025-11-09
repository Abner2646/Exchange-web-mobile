// mobile/app/(tabs)/profile.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../hooks/useProfile';
import { spacing, fontSize, borderRadius } from '../../constants/theme';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function Profile() {
  const { theme } = useTheme();
  const { logout } = useAuth();
  const {
    profile,
    loading,
    changePassword,
    changingPassword,
    toggle2FA,
    toggling2FA,
    submitKYC,
    submittingKYC,
  } = useProfile();

  // Estados para formulario de cambio de contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Estados para KYC
  const [kycForm, setKycForm] = useState({
    nombreCompleto: '',
    fechaNacimiento: '',
    nacionalidad: '',
    direccion: '',
    ciudad: '',
    codigoPostal: '',
    documentoTipo: 'dni',
    documentoNumero: '',
  });
  const [documentoFrontal, setDocumentoFrontal] = useState(null);
  const [selfie, setSelfie] = useState(null);

  // Handler para cambio de contraseña
  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    const result = await changePassword(currentPassword, newPassword);

    if (result.success) {
      Alert.alert('Éxito', 'Contraseña cambiada exitosamente');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      Alert.alert('Error', result.error);
    }
  };

  // Handler para toggle 2FA
  const handleToggle2FA = async () => {
    const newState = !profile.dosFactoresActivado;
    console.log(`🔄 Intentando ${newState ? 'activar' : 'desactivar'} 2FA...`);

    const result = await toggle2FA(newState);

    if (result.success) {
      Alert.alert(
        'Éxito',
        `Autenticación de dos factores ${newState ? 'activada' : 'desactivada'}`
      );
    } else {
      console.error('❌ Error en toggle 2FA:', result.error);
      Alert.alert('Error', result.error || 'Error al cambiar estado de 2FA');
    }
  };

  // Handler para selección de imagen
  const pickImage = async (type) => {
    // Pedir permisos
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permiso requerido',
        'Necesitamos acceso a tu galería para seleccionar imágenes'
      );
      return;
    }

    // Abrir selector de imagen
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'selfie' ? [1, 1] : [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      if (type === 'documento') {
        setDocumentoFrontal(asset);
      } else if (type === 'selfie') {
        setSelfie(asset);
      }
    }
  };

  // Handler para submit KYC
  const handleKYCSubmit = async () => {
    // Validaciones básicas
    if (!kycForm.nombreCompleto || !kycForm.fechaNacimiento || !kycForm.documentoNumero) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    if (!documentoFrontal || !selfie) {
      Alert.alert('Error', 'Por favor sube todos los documentos requeridos');
      return;
    }

    const kycData = {
      ...kycForm,
      documentoFrontal: documentoFrontal.uri,
      selfie: selfie.uri,
    };

    const result = await submitKYC(kycData);

    if (result.success) {
      Alert.alert('Éxito', 'Verificación KYC enviada. Será revisada en 24-48 horas');
      // Reset form
      setKycForm({
        nombreCompleto: '',
        fechaNacimiento: '',
        nacionalidad: '',
        direccion: '',
        ciudad: '',
        codigoPostal: '',
        documentoTipo: 'dni',
        documentoNumero: '',
      });
      setDocumentoFrontal(null);
      setSelfie(null);
    } else {
      Alert.alert('Error', result.error);
    }
  };

  // Handler para logout
  const handleLogout = () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro que deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.brandPrimary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.background }]}>
        <Ionicons name="alert-circle-outline" size={64} color={theme.error} />
        <Text style={[styles.errorText, { color: theme.textPrimary }]}>
          Error cargando perfil
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>
              Perfil
            </Text>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Ionicons name="log-out-outline" size={24} color={theme.error} />
            </TouchableOpacity>
          </View>

          {/* SECCIÓN: INFORMACIÓN DE PERFIL */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
              Información de Perfil
            </Text>
            <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
              Información de tu cuenta
            </Text>

            <Card style={styles.infoCard}>
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                    Usuario
                  </Text>
                  <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
                    {profile.username}
                  </Text>
                </View>

                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                    Email
                  </Text>
                  <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
                    {profile.email}
                  </Text>
                </View>

                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                    ID de Usuario
                  </Text>
                  <Text
                    style={[styles.infoValue, styles.monoText, { color: theme.textPrimary }]}
                  >
                    {profile.id}
                  </Text>
                </View>

                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                    Rol
                  </Text>
                  <View style={[styles.badge, { backgroundColor: theme.brandTertiary }]}>
                    <Text style={[styles.badgeText, { color: theme.brandPrimary }]}>
                      {profile.rol}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                    Email Verificado
                  </Text>
                  <View style={styles.statusContainer}>
                    {profile.emailVerificado ? (
                      <>
                        <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                        <Text style={[styles.statusText, { color: theme.success }]}>
                          Verificado
                        </Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="close-circle" size={16} color={theme.error} />
                        <Text style={[styles.statusText, { color: theme.error }]}>
                          No verificado
                        </Text>
                      </>
                    )}
                  </View>
                </View>

                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                    Fecha de Registro
                  </Text>
                  <Text style={[styles.infoValue, { color: theme.textPrimary }]}>
                    {new Date(profile.created_at).toLocaleDateString('es-AR')}
                  </Text>
                </View>
              </View>
            </Card>
          </View>

          {/* SECCIÓN: SEGURIDAD */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
              Seguridad
            </Text>
            <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
              Gestiona la seguridad de tu cuenta
            </Text>

            {/* Card: Cambiar Contraseña */}
            <Card style={styles.securityCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.brandPrimary} />
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                  Cambiar Contraseña
                </Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Contraseña Actual
                </Text>
                <Input
                  placeholder="Ingresa tu contraseña actual"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!changingPassword}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Nueva Contraseña
                </Text>
                <Input
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!changingPassword}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Confirmar Nueva Contraseña
                </Text>
                <Input
                  placeholder="Repite tu nueva contraseña"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!changingPassword}
                />
              </View>

              <Button
                variant="primary"
                onPress={handleChangePassword}
                loading={changingPassword}
                disabled={
                  changingPassword ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword
                }
              >
                Cambiar Contraseña
              </Button>
            </Card>

            {/* Card: Autenticación 2FA */}
            <Card style={styles.securityCard}>
              <View style={styles.twoFAHeader}>
                <View style={styles.twoFAInfo}>
                  <View style={styles.cardHeader}>
                    <MaterialCommunityIcons
                      name="shield-lock-outline"
                      size={20}
                      color={theme.brandPrimary}
                    />
                    <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                      Autenticación de Dos Factores
                    </Text>
                  </View>
                  <Text style={[styles.cardDescription, { color: theme.textSecondary }]}>
                    Agrega una capa extra de seguridad a tu cuenta
                  </Text>
                </View>
                <View style={styles.twoFAToggleContainer}>
                  {toggling2FA && (
                    <ActivityIndicator
                      size="small"
                      color={theme.brandPrimary}
                      style={styles.twoFALoader}
                    />
                  )}
                  <Switch
                    value={profile.dosFactoresActivado}
                    onValueChange={handleToggle2FA}
                    disabled={toggling2FA}
                    trackColor={{
                      false: theme.interactiveDisabled,
                      true: theme.brandPrimary,
                    }}
                    thumbColor={Platform.OS === 'ios' ? undefined : '#ffffff'}
                    ios_backgroundColor={theme.interactiveDisabled}
                  />
                </View>
              </View>

              {toggling2FA ? (
                <View
                  style={[
                    styles.statusBox,
                    { backgroundColor: theme.infoBg },
                  ]}
                >
                  <ActivityIndicator size="small" color={theme.brandPrimary} />
                  <Text
                    style={[
                      styles.statusBoxText,
                      { color: theme.brandPrimary },
                    ]}
                  >
                    Procesando cambio de seguridad...
                  </Text>
                </View>
              ) : (
                <View
                  style={[
                    styles.statusBox,
                    {
                      backgroundColor: profile.dosFactoresActivado
                        ? theme.successBg
                        : theme.warningBg,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      profile.dosFactoresActivado
                        ? 'checkmark-circle-outline'
                        : 'alert-circle-outline'
                    }
                    size={20}
                    color={profile.dosFactoresActivado ? theme.success : theme.warning}
                  />
                  <Text
                    style={[
                      styles.statusBoxText,
                      {
                        color: profile.dosFactoresActivado ? theme.success : theme.warning,
                      },
                    ]}
                  >
                    La autenticación de dos factores está{' '}
                    <Text style={styles.statusBold}>
                      {profile.dosFactoresActivado ? 'activada' : 'desactivada'}
                    </Text>
                  </Text>
                </View>
              )}
            </Card>
          </View>

          {/* SECCIÓN: KYC */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
              Verificación de Identidad (KYC)
            </Text>
            <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
              Completa tu verificación para acceder a límites más altos
            </Text>

            <Card style={styles.kycCard}>
              {profile.kycVerificado ? (
                <View style={styles.kycVerified}>
                  <View
                    style={[
                      styles.kycVerifiedIcon,
                      { backgroundColor: theme.successBg },
                    ]}
                  >
                    <Ionicons name="checkmark" size={48} color={theme.success} />
                  </View>
                  <Text style={[styles.kycVerifiedTitle, { color: theme.textPrimary }]}>
                    Identidad Verificada
                  </Text>
                  <Text style={[styles.kycVerifiedText, { color: theme.textSecondary }]}>
                    Tu cuenta ha sido verificada exitosamente
                  </Text>
                </View>
              ) : (
                <>
                  {/* Datos Personales */}
                  <Text style={[styles.kycSectionTitle, { color: theme.textPrimary }]}>
                    Datos Personales
                  </Text>

                  <View style={styles.formGroup}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                      Nombre Completo *
                    </Text>
                    <Input
                      placeholder="Juan Pérez"
                      value={kycForm.nombreCompleto}
                      onChangeText={(text) =>
                        setKycForm({ ...kycForm, nombreCompleto: text })
                      }
                      editable={!submittingKYC}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                      Fecha de Nacimiento *
                    </Text>
                    <Input
                      placeholder="DD/MM/AAAA"
                      value={kycForm.fechaNacimiento}
                      onChangeText={(text) =>
                        setKycForm({ ...kycForm, fechaNacimiento: text })
                      }
                      editable={!submittingKYC}
                    />
                  </View>

                  <View style={styles.formRow}>
                    <View style={styles.formHalf}>
                      <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                        Nacionalidad
                      </Text>
                      <Input
                        placeholder="Argentina"
                        value={kycForm.nacionalidad}
                        onChangeText={(text) =>
                          setKycForm({ ...kycForm, nacionalidad: text })
                        }
                        editable={!submittingKYC}
                      />
                    </View>

                    <View style={styles.formHalf}>
                      <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                        Ciudad
                      </Text>
                      <Input
                        placeholder="Buenos Aires"
                        value={kycForm.ciudad}
                        onChangeText={(text) => setKycForm({ ...kycForm, ciudad: text })}
                        editable={!submittingKYC}
                      />
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                      Dirección
                    </Text>
                    <Input
                      placeholder="Av. Corrientes 1234"
                      value={kycForm.direccion}
                      onChangeText={(text) =>
                        setKycForm({ ...kycForm, direccion: text })
                      }
                      editable={!submittingKYC}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                      Código Postal
                    </Text>
                    <Input
                      placeholder="1043"
                      value={kycForm.codigoPostal}
                      onChangeText={(text) =>
                        setKycForm({ ...kycForm, codigoPostal: text })
                      }
                      keyboardType="numeric"
                      editable={!submittingKYC}
                    />
                  </View>

                  {/* Documentos */}
                  <Text
                    style={[
                      styles.kycSectionTitle,
                      styles.sectionMargin,
                      { color: theme.textPrimary },
                    ]}
                  >
                    Documentos de Identidad
                  </Text>

                  <View style={styles.formRow}>
                    <View style={styles.formHalf}>
                      <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                        Tipo de Documento *
                      </Text>
                      <Input
                        placeholder="DNI"
                        value={kycForm.documentoTipo}
                        editable={false}
                      />
                    </View>

                    <View style={styles.formHalf}>
                      <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                        Número *
                      </Text>
                      <Input
                        placeholder="12345678"
                        value={kycForm.documentoNumero}
                        onChangeText={(text) =>
                          setKycForm({ ...kycForm, documentoNumero: text })
                        }
                        keyboardType="numeric"
                        editable={!submittingKYC}
                      />
                    </View>
                  </View>

                  {/* Cargar Documentos */}
                  <Text
                    style={[
                      styles.kycSectionTitle,
                      styles.sectionMargin,
                      { color: theme.textPrimary },
                    ]}
                  >
                    Cargar Documentos
                  </Text>

                  <View style={styles.uploadGrid}>
                    {/* Documento Frontal */}
                    <TouchableOpacity
                      style={[
                        styles.uploadBox,
                        { backgroundColor: theme.backgroundElevated, borderColor: theme.border },
                      ]}
                      onPress={() => pickImage('documento')}
                      disabled={submittingKYC}
                    >
                      {documentoFrontal ? (
                        <View style={styles.uploadSelected}>
                          <Ionicons
                            name="document-text"
                            size={32}
                            color={theme.brandPrimary}
                          />
                          <Text
                            style={[styles.uploadSelectedText, { color: theme.textPrimary }]}
                            numberOfLines={2}
                          >
                            {documentoFrontal.fileName || 'Documento seleccionado'}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.uploadContent}>
                          <Ionicons
                            name="cloud-upload-outline"
                            size={32}
                            color={theme.textMuted}
                          />
                          <Text style={[styles.uploadText, { color: theme.textPrimary }]}>
                            Foto Frontal del Documento
                          </Text>
                          <Text style={[styles.uploadHint, { color: theme.textMuted }]}>
                            JPG, PNG (max 5MB)
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Selfie */}
                    <TouchableOpacity
                      style={[
                        styles.uploadBox,
                        { backgroundColor: theme.backgroundElevated, borderColor: theme.border },
                      ]}
                      onPress={() => pickImage('selfie')}
                      disabled={submittingKYC}
                    >
                      {selfie ? (
                        <View style={styles.uploadSelected}>
                          <Ionicons name="camera" size={32} color={theme.brandPrimary} />
                          <Text
                            style={[styles.uploadSelectedText, { color: theme.textPrimary }]}
                            numberOfLines={2}
                          >
                            {selfie.fileName || 'Selfie seleccionada'}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.uploadContent}>
                          <Ionicons
                            name="camera-outline"
                            size={32}
                            color={theme.textMuted}
                          />
                          <Text style={[styles.uploadText, { color: theme.textPrimary }]}>
                            Selfie con Documento
                          </Text>
                          <Text style={[styles.uploadHint, { color: theme.textMuted }]}>
                            JPG, PNG (max 5MB)
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>

                  <Button
                    variant="primary"
                    onPress={handleKYCSubmit}
                    loading={submittingKYC}
                    disabled={submittingKYC}
                    style={styles.submitButton}
                  >
                    Enviar Verificación
                  </Button>
                </>
              )}
            </Card>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  errorText: {
    fontSize: fontSize.lg,
    marginTop: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  pageTitle: {
    fontSize: fontSize.xxxl,
    fontWeight: 'bold',
  },
  logoutButton: {
    padding: spacing.xs,
  },

  // Sections
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  sectionMargin: {
    marginTop: spacing.lg,
  },

  // Info Card
  infoCard: {
    padding: spacing.md,
  },
  infoGrid: {
    gap: spacing.md,
  },
  infoItem: {
    gap: spacing.xs,
  },
  infoLabel: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: fontSize.base,
  },
  monoText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  badgeText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusText: {
    fontSize: fontSize.base,
    fontWeight: '500',
  },

  // Security Cards
  securityCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },

  // 2FA
  twoFAHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  twoFAInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  twoFAToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  twoFALoader: {
    marginRight: spacing.xs,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  statusBoxText: {
    fontSize: fontSize.sm,
    flex: 1,
  },
  statusBold: {
    fontWeight: '600',
  },

  // KYC
  kycCard: {
    padding: spacing.md,
  },
  kycVerified: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  kycVerifiedIcon: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  kycVerifiedTitle: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  kycVerifiedText: {
    fontSize: fontSize.base,
    textAlign: 'center',
  },
  kycSectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  formHalf: {
    flex: 1,
  },

  // Upload
  uploadGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  uploadBox: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  uploadContent: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  uploadText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    textAlign: 'center',
  },
  uploadHint: {
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  uploadSelected: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  uploadSelectedText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    textAlign: 'center',
  },
  submitButton: {
    marginTop: spacing.md,
  },
});