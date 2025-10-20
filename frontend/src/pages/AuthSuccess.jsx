// src/pages/AuthSuccess.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/AuthSuccess.css';

const AuthSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processAuth = async () => {
      const token = searchParams.get('token');
      const isNewUser = searchParams.get('new') === 'true';

      if (!token) {
        navigate('/login');
        return;
      }

      try {
        // 1. Guardar token
        localStorage.setItem('token', token);

        // 2. Decodificar token
        const payload = JSON.parse(atob(token.split('.')[1]));

        // 3. Actualizar contexto
        login({
          id: payload.userId,
          email: payload.email,
          username: payload.username,
          role: payload.rol,
        });

        // 4. Esperar un tick para que React actualice el estado
        await new Promise((resolve) => setTimeout(resolve, 100));

        // 5. Obtener ruta de redirect guardada (si existe)
        const savedRedirect = sessionStorage.getItem('loginRedirect');
        sessionStorage.removeItem('loginRedirect'); // Limpiar

        const redirectPath = savedRedirect || '/';

        // 6. Redirigir según tipo de usuario
        if (isNewUser) {
          navigate(redirectPath, { replace: true });
        } else {
          navigate(redirectPath, { replace: true });
        }
      } catch (error) {
        console.error('Error processing auth:', error);
        localStorage.removeItem('token');
        navigate('/login');
      } finally {
        setIsProcessing(false);
      }
    };

    processAuth();
  }, [searchParams, navigate, login]);

  return (
    <div className="auth-success-container">
      <div className="auth-success-content">
        <div className="auth-success-spinner"></div>
        <p className="auth-success-text">Iniciando sesión...</p>
      </div>
    </div>
  );
};

export default AuthSuccess;