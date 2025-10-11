/*DÓNDE GUARDA EL JWT:
Browser: localStorage del navegador
Key: 'token'
Valor: El JWT string que devuelve el backend
*/
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import '../styles/Login.css';

const Login = () => {
    const [emailOrUsername, setEmailOrUsername] = useState('');
    const [password, setPassword] = useState('');
    const [codigo2FA, setCodigo2FA] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [requires2FA, setRequires2FA] = useState(false);
    const [preAuthToken, setPreAuthToken] = useState('');
    const { login, loginWithGoogle } = useAuth();
    const navigate = useNavigate();

    const handleGoogleLogin = () => {
        setError('');
        setSuccessMessage('');
        loginWithGoogle();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccessMessage('');
        
        try {
            if (!requires2FA) {
                // Primer paso: verificar credenciales
                const res = await fetch(`${API_URL}/usuario/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ emailOrUsername, password }),
                });
                
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || 'Login failed');
                }
                
                const data = await res.json();
                
                if (data.requires2FA) {
                    // Requiere 2FA - mostrar pantalla de verificación
                    setRequires2FA(true);
                    setPreAuthToken(data.preAuthToken);
                    setSuccessMessage('Credenciales correctas. Revisa tu email para el código de verificación.');
                } else {
                    // Login exitoso sin 2FA
                    localStorage.setItem('token', data.token);
                    login({ id: data.user.id, username: data.user.username });
                    navigate('/');
                }
            } else {
                // Segundo paso: verificar código 2FA
                const res = await fetch(`${API_URL}/usuario/verify-2fa`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': preAuthToken
                    },
                    body: JSON.stringify({ codigo: codigo2FA }),
                });
                
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || 'Código de verificación inválido');
                }
                
                const data = await res.json();
                
                // Login exitoso con 2FA
                localStorage.setItem('token', data.token);
                login({ id: data.user.id, username: data.user.username });
                navigate('/');
            }
        } catch (error) {
            if (requires2FA) {
                setError("Código de verificación incorrecto. Por favor, inténtalo de nuevo.");
            } else {
                setError("Usuario o contraseña incorrectos. Por favor, inténtalo de nuevo.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResend2FA = async () => {
        try {
            setLoading(true);
            setError('');
            
                const res = await fetch(`${API_URL}/usuario/resend-2fa`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ preAuthToken }),
            });
            
            if (res.ok) {
                setSuccessMessage('Nuevo código enviado a tu email');
                setTimeout(() => setSuccessMessage(''), 4000);
            } else {
                const errorData = await res.json();
                setError(errorData.error || 'Error al reenviar código');
            }
        } catch (error) {
            setError('Error al reenviar código');
        } finally {
            setLoading(false);
        }
    };

    const resetToLogin = () => {
        setRequires2FA(false);
        setPreAuthToken('');
        setCodigo2FA('');
        setError('');
        setSuccessMessage('');
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h2 className="login-title">
                    {requires2FA ? 'Verificación en dos pasos' : 'Iniciar Sesión'}
                </h2>
                
                <p className="login-description">
                    {requires2FA 
                        ? 'Ingresa el código de verificación enviado a tu email'
                        : 'Accede a tu cuenta de trading'
                    }
                </p>

                {/* Botón de Google - solo mostrar en login inicial */}
                {!requires2FA && (
                    <>
                        <button
                            onClick={handleGoogleLogin}
                            className="login-google-button"
                        >
                            <svg className="login-google-icon" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Continuar con Google
                        </button>

                        {/* Separador */}
                        <div className="login-divider">
                            <span>o</span>
                        </div>
                    </>
                )}

                {/* Mensajes */}
                {error && (
                    <div className="login-error">
                        <span>⚠</span>
                        <span>{error}</span>
                    </div>
                )}
                
                {successMessage && (
                    <div className="login-success">
                        <span>✓</span>
                        <span>{successMessage}</span>
                    </div>
                )}
                
                {/* Formulario */}
                <form onSubmit={handleSubmit} className="login-form">
                    {!requires2FA ? (
                        // Campos de login inicial
                        <>
                            <div className="login-form-group">
                                <label htmlFor="emailOrUsername" className="login-label">
                                    Email o Usuario *
                                </label>
                                <input
                                    type="text"
                                    id="emailOrUsername"
                                    className="login-input"
                                    placeholder="Ingresa tu email o usuario"
                                    value={emailOrUsername}
                                    onChange={(e) => setEmailOrUsername(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="login-form-group">
                                <label htmlFor="password" className="login-label">
                                    Contraseña *
                                </label>
                                <input
                                    type="password"
                                    id="password"
                                    className="login-input"
                                    placeholder="Ingresa tu contraseña"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <div className="login-forgot-password">
                                    <a href="/forgot-password" className="forgot-password-link">
                                        ¿Olvidaste tu contraseña?
                                    </a>
                                </div>
                            </div>
                        </>
                    ) : (
                        // Campo de código 2FA
                        <div className="login-form-group">
                            <label htmlFor="codigo2FA" className="login-label">
                                Código de verificación *
                            </label>
                            <input
                                type="text"
                                id="codigo2FA"
                                className="login-input"
                                placeholder="Ingresa el código de 6 dígitos"
                                value={codigo2FA}
                                onChange={(e) => setCodigo2FA(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                maxLength="6"
                                autoComplete="one-time-code"
                                autoFocus
                                required
                            />
                            <div className="login-2fa-actions">
                                <button
                                    type="button"
                                    onClick={handleResend2FA}
                                    className="resend-code-button"
                                    disabled={loading}
                                >
                                    Reenviar código
                                </button>
                            </div>
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={loading}
                        className={`login-submit-button ${loading ? 'loading' : ''}`}
                    >
                        {loading ? (
                            <>
                                <span className="login-spinner"></span>
                                {requires2FA ? 'Verificando...' : 'Iniciando sesión...'}
                            </>
                        ) : (
                            requires2FA ? 'Verificar código' : 'Iniciar Sesión'
                        )}
                    </button>

                    {/* Botón para volver al login desde 2FA */}
                    {requires2FA && (
                        <button
                            type="button"
                            onClick={resetToLogin}
                            className="login-back-button"
                        >
                            ← Volver al login
                        </button>
                    )}
                </form>

                {/* Footer - solo mostrar en login inicial */}
                {!requires2FA && (
                    <div className="login-terms">
                        <p>
                            ¿No tienes una cuenta? 
                            <a href="/register" className="login-register-link">
                                Regístrate
                            </a>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Login;