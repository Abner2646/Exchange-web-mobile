import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../styles/AuthSuccess.css';

const AuthSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const isNewUser = searchParams.get('new') === 'true';

    if (token) {
      localStorage.setItem('token', token);
      
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      if (isNewUser) {
        navigate('/onboarding');
      } else {
        navigate('/');
      }
      
      window.location.reload();
    } else {
      navigate('/login');
    }
  }, [searchParams, navigate]);

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