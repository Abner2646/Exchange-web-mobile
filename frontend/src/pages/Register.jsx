import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../styles/Register.css';

const API_URL = REACT_APP_API_URL

const Register = () => {
    const [formData, setFormData] = useState({
        email: '',
        username: '',
        password: '',
        confirmPassword: '',
        pais: 'AR'
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [validationErrors, setValidationErrors] = useState({});
    const { loginWithGoogle, login } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Limpiar error específico cuando el usuario empieza a escribir
        if (validationErrors[name]) {
            setValidationErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateForm = () => {
        const errors = {};

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formData.email) {
            errors.email = 'El email es requerido';
        } else if (!emailRegex.test(formData.email)) {
            errors.email = 'Ingresa un email válido';
        }

        // Username validation
        if (!formData.username) {
            errors.username = 'El usuario es requerido';
        } else if (formData.username.length < 3) {
            errors.username = 'El usuario debe tener al menos 3 caracteres';
        }

        // Password validation
        if (!formData.password) {
            errors.password = 'La contraseña es requerida';
        } else if (formData.password.length < 8) {
            errors.password = 'La contraseña debe tener al menos 8 caracteres';
        }

        // Confirm password validation
        if (!formData.confirmPassword) {
            errors.confirmPassword = 'Debes confirmar la contraseña';
        } else if (formData.password !== formData.confirmPassword) {
            errors.confirmPassword = 'Las contraseñas no coinciden';
        }

        // País validation
        if (!formData.pais) {
            errors.pais = 'El país es requerido';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleGoogleLogin = () => {
        setError('');
        loginWithGoogle();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        if (!validateForm()) {
            setLoading(false);
            return;
        }

        try {
            const { confirmPassword, ...registerData } = formData;
            
            const res = await fetch(`${API_URL}usuario/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registerData),
            });
            
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Error en el registro');
            }
            
            const data = await res.json();
            
            // Registro exitoso - hacer login automático
            if (data.token) {
                // Si el backend devuelve token directamente
                localStorage.setItem('token', data.token);
                login({ id: data.user.id, username: data.user.username });
                navigate('/');
            } else {
                // Si no hay token, hacer login con las credenciales usando el endpoint correcto
                const loginRes = await fetch(`${API_URL}usuario/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        emailOrUsername: registerData.username, 
                        password: registerData.password 
                    }),
                });
                
                if (loginRes.ok) {
                    const loginData = await loginRes.json();
                    
                    if (loginData.requires2FA) {
                        // Si requiere 2FA, redirigir a login para completar el proceso
                        navigate('/login', { 
                            state: { 
                                message: 'Cuenta creada exitosamente. Completa la verificación 2FA.',
                                username: registerData.username
                            } 
                        });
                    } else {
                        // Login exitoso sin 2FA
                        localStorage.setItem('token', loginData.token);
                        login({ id: loginData.user.id, username: loginData.user.username });
                        navigate('/');
                    }
                } else {
                    const errorData = await loginRes.json();
                    // Si falla el login automático, redirigir a login manual
                    navigate('/login', { 
                        state: { 
                            message: 'Cuenta creada exitosamente. Inicia sesión con tus credenciales.',
                            username: registerData.username
                        } 
                    });
                }
            }
            
        } catch (error) {
            console.error('Register error:', error);
            setError(error.message || "Error al crear la cuenta. Por favor, inténtalo de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="register-container">
            <div className="register-card">
                <h2 className="register-title">Crear Cuenta</h2>
                
                <p className="register-description">
                    Únete a la plataforma de trading
                </p>

                {/* Botón de Google */}
                <button
                    onClick={handleGoogleLogin}
                    className="register-google-button"
                >
                    <svg className="register-google-icon" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Registrarse con Google
                </button>

                {/* Separador */}
                <div className="register-divider">
                    <span>o</span>
                </div>

                {/* Error message general */}
                {error && (
                    <div className="register-error">
                        <span>⚠</span>
                        <span>{error}</span>
                    </div>
                )}
                
                {/* Formulario */}
                <form onSubmit={handleSubmit} className="register-form">
                    <div className="register-form-group">
                        <label htmlFor="email" className="register-label">
                            Email *
                        </label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            className={`register-input ${validationErrors.email ? 'error' : ''}`}
                            placeholder="tu@email.com"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                        {validationErrors.email && (
                            <span className="register-field-error">{validationErrors.email}</span>
                        )}
                    </div>

                    <div className="register-form-group">
                        <label htmlFor="username" className="register-label">
                            Usuario *
                        </label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            className={`register-input ${validationErrors.username ? 'error' : ''}`}
                            placeholder="Elige tu nombre de usuario"
                            value={formData.username}
                            onChange={handleChange}
                            required
                        />
                        {validationErrors.username && (
                            <span className="register-field-error">{validationErrors.username}</span>
                        )}
                    </div>

                    <div className="register-form-group">
                        <label htmlFor="pais" className="register-label">
                            País *
                        </label>
                        <select
                            id="pais"
                            name="pais"
                            className={`register-input ${validationErrors.pais ? 'error' : ''}`}
                            value={formData.pais}
                            onChange={handleChange}
                            required
                        >
                            <option value="AR">Argentina</option>
                            <option value="BR">Brasil</option>
                            <option value="CL">Chile</option>
                            <option value="CO">Colombia</option>
                            <option value="MX">México</option>
                            <option value="PE">Perú</option>
                            <option value="UY">Uruguay</option>
                            <option value="US">Estados Unidos</option>
                            <option value="ES">España</option>
                            <option value="OTHER">Otro</option>
                        </select>
                        {validationErrors.pais && (
                            <span className="register-field-error">{validationErrors.pais}</span>
                        )}
                    </div>

                    <div className="register-form-group">
                        <label htmlFor="password" className="register-label">
                            Contraseña *
                        </label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            className={`register-input ${validationErrors.password ? 'error' : ''}`}
                            placeholder="Mínimo 8 caracteres"
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />
                        {validationErrors.password && (
                            <span className="register-field-error">{validationErrors.password}</span>
                        )}
                    </div>

                    <div className="register-form-group">
                        <label htmlFor="confirmPassword" className="register-label">
                            Confirmar Contraseña *
                        </label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            className={`register-input ${validationErrors.confirmPassword ? 'error' : ''}`}
                            placeholder="Repite tu contraseña"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            required
                        />
                        {validationErrors.confirmPassword && (
                            <span className="register-field-error">{validationErrors.confirmPassword}</span>
                        )}
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className={`register-submit-button ${loading ? 'loading' : ''}`}
                    >
                        {loading ? (
                            <>
                                <span className="register-spinner"></span>
                                Creando cuenta...
                            </>
                        ) : (
                            'Crear Cuenta'
                        )}
                    </button>

                    {/* Mensaje de términos */}
                    <p className="register-terms-message">
                        Al registrarte, aceptas nuestros <a href="/terminos-y-condiciones" className="register-terms-link">términos y condiciones</a>
                    </p>
                </form>

                {/* Footer con enlace de login */}
                <div className="register-terms">
                    <p>
                        ¿Ya tienes cuenta? 
                        <a href="/login" className="register-login-link">
                            Inicia Sesión
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;