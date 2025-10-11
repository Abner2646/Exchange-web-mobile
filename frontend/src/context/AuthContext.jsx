// /src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { API_URL } from '../config';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe estar dentro de AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // use API_URL from config

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      verifyToken(token);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (token) => {
    try {
      // Decodificar el JWT para obtener info del usuario
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUser({
        id: payload.id,
        email: payload.email,
        username: payload.username,
        role: payload.role,
        companyId: payload.rol
      });
    } catch (error) {
      console.error('Error verificando token:', error);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  // ✅ AGREGA ESTA FUNCIÓN
  const login = (userData) => {
    setUser(userData);
  };

  const loginWithGoogle = () => {
    // Redirige a tu backend para iniciar el flujo OAuth
    window.location.href = `${API_URL}/auth/google`;
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      });
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  const value = {
    user,
    login, // ✅ AGREGA ESTO AL VALUE
    loginWithGoogle,
    logout,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};