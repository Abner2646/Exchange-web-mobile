// src/components/common/RequireEmailVerified.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { useEffect, useState } from 'react';

/**
 * Componente para proteger rutas que requieren email verificado
 * Usuarios de Google pasan automáticamente (email pre-verificado)
 * Usuarios tradicionales sin verificar son redirigidos a /verificar-email
 */
const RequireEmailVerified = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [hasShownToast, setHasShownToast] = useState(false);

  useEffect(() => {
    // Mostrar toast solo una vez por sesión
    if (user && !user.emailVerificado && !user.googleId && !hasShownToast) {
      toast.error('Debes verificar tu email para acceder a esta función', {
        duration: 4000,
        icon: '🔒',
      });
      setHasShownToast(true);
    }
  }, [user, hasShownToast]);

  if (!user) {
    // Si no está autenticado, redirigir a login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // ⭐ Usuarios de Google tienen email pre-verificado por Google
  if (user.googleId) {
    return children;
  }

  // ⭐ Si el email NO está verificado, redirigir a /verificar-email
  if (!user.emailVerificado) {
    return <Navigate to="/verificar-email" state={{ from: location }} replace />;
  }

  // Email verificado ✅ - Permitir acceso
  return children;
};

export default RequireEmailVerified;