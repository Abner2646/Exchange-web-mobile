// src/hooks/useProfile.js
import { useState, useEffect } from 'react';
import userService from '../services/userService';
import { useAuth } from '../context/AuthContext';

export const useProfile = () => {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estado para cambio de contraseña
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(null);

  // Estado para 2FA
  const [toggling2FA, setToggling2FA] = useState(false);
  const [twoFAError, setTwoFAError] = useState(null);

  // Estado para KYC
  const [submittingKYC, setSubmittingKYC] = useState(false);
  const [kycError, setKycError] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await userService.getMyProfile();
      setProfile(data);
      console.log('✅ Perfil cargado:', data);
    } catch (err) {
      console.error('❌ Error cargando perfil:', err);
      setError(err.response?.data?.message || 'Error cargando perfil');
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      setChangingPassword(true);
      setPasswordError(null);
      await userService.changePassword(currentPassword, newPassword);
      console.log('✅ Contraseña cambiada');
      return { success: true };
    } catch (err) {
      console.error('❌ Error cambiando contraseña:', err);
      const errorMsg = err.response?.data?.message || 'Error cambiando contraseña';
      setPasswordError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setChangingPassword(false);
    }
  };

  const toggle2FA = async (enable) => {
    try {
      setToggling2FA(true);
      setTwoFAError(null);
      await userService.toggle2FA(enable);
      
      // Actualizar perfil local
      setProfile((prev) => ({ ...prev, dosFactoresActivado: enable }));
      
      // Actualizar contexto
      updateUser({ dosFactoresActivado: enable });
      
      console.log(`✅ 2FA ${enable ? 'activado' : 'desactivado'}`);
      return { success: true };
    } catch (err) {
      console.error('❌ Error cambiando 2FA:', err);
      const errorMsg = err.response?.data?.message || 'Error cambiando estado 2FA';
      setTwoFAError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setToggling2FA(false);
    }
  };

  const submitKYC = async (kycData) => {
    try {
      setSubmittingKYC(true);
      setKycError(null);
      const result = await userService.submitKYC(kycData);
      console.log('✅ KYC enviado');
      return { success: true, data: result };
    } catch (err) {
      console.error('❌ Error enviando KYC:', err);
      const errorMsg = err.response?.data?.message || 'Error enviando verificación KYC';
      setKycError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setSubmittingKYC(false);
    }
  };

  return {
    profile,
    loading,
    error,
    fetchProfile,
    
    // Password
    changePassword,
    changingPassword,
    passwordError,
    
    // 2FA
    toggle2FA,
    toggling2FA,
    twoFAError,
    
    // KYC
    submitKYC,
    submittingKYC,
    kycError,
  };
};