// mobile/contexts/AuthContext.js (mobile)
import React, { createContext, useState, useContext, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../services/authService';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredUser();
  }, []);

  const loadStoredUser = async () => {
    try {
      console.log('[AuthContext] Cargando usuario...');
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      
      if (token && userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        console.log('[AuthContext] Usuario cargado:', parsedUser.email);
      } else if (token) {
        try {
          const decodedUser = authService.getCurrentUser();
          setUser(decodedUser);
          await AsyncStorage.setItem('user', JSON.stringify(decodedUser));
          console.log('[AuthContext] Usuario decodificado del token');
        } catch (error) {
          console.error('[AuthContext] Error decodificando token:', error);
          await AsyncStorage.removeItem('token');
        }
      } else {
        console.log('[AuthContext] No hay sesión guardada');
      }
    } catch (error) {
      console.error('[AuthContext] Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (userData) => {
    try {
      console.log('[AuthContext] Login con userData:', userData);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      console.log('[AuthContext] Usuario guardado exitosamente');
    } catch (error) {
      console.error('[AuthContext] Error al guardar usuario:', error);
    }
  };

  const loginWithGoogle = async () => {
    try {
      console.log('[AuthContext] Iniciando Google login...');
      const { user: googleUser, token } = await authService.loginWithGoogle();
      
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(googleUser));
      setUser(googleUser);
      
      console.log('[AuthContext] Google login exitoso');
      return googleUser;
    } catch (error) {
      console.error('[AuthContext] Error en Google login:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log('[AuthContext] Cerrando sesión...');
      await authService.logout();
      await AsyncStorage.multiRemove(['token', 'user']);
      setUser(null);
      console.log('[AuthContext] Sesión cerrada');
    } catch (error) {
      console.error('[AuthContext] Error al cerrar sesión:', error);
    }
  };

  const updateUser = (updatedData) => {
    const newUser = { ...user, ...updatedData };
    setUser(newUser);
    AsyncStorage.setItem('user', JSON.stringify(newUser));
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#00d4aa" />
      </View>
    );
  }

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        login,
        loginWithGoogle,
        logout, 
        updateUser,
        loading,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};