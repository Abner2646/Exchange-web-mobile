import { useNavigate } from 'react-router-dom';
import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import GoogleLoginButton from '../components/GoogleLoginButton';
import '../styles/signUp.css';

export default function Register() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMessage('');
        try {
            const res = await fetch('http://localhost:3001/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username.toLowerCase(),
                    email: email.toLowerCase(),
                    password,
                    role: 'user',
                    permissions: ['read']
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || errorData.error || 'Error registering');
            }

            // Only redirect, no message shown
            navigate('/login');
        } catch (error) {
            setErrorMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="register-container">
            <div className="register-card">
                <h1 className="register-title">
                    Create Account
                </h1>

                {/* Google Auth Button */}
                <div className="google-auth-section" style={{ marginBottom: '20px' }}>
                    <GoogleLoginButton />
                </div>

                {/* Visual separator */}
                <div className="divider" style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    margin: '20px 0',
                    color: '#666'
                }}>
                    <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #ddd' }} />
                    <span style={{ padding: '0 15px', fontSize: '14px' }}>or register with email</span>
                    <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #ddd' }} />
                </div>

                {/* Error message */}
                {errorMessage && (
                    <div style={{
                        backgroundColor: '#fee',
                        color: '#c33',
                        padding: '10px',
                        borderRadius: '4px',
                        marginBottom: '15px',
                        fontSize: '14px',
                        border: '1px solid #fcc'
                    }}>
                        {errorMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="username" className="form-label">
                            User *
                        </label>
                        <input
                            type="text"
                            id="username"
                            className="form-input"
                            placeholder="Choose a user"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email" className="form-label">
                            Email *
                        </label>
                        <input
                            type="email"
                            id="email"
                            className="form-input"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password" className="form-label">
                            Password *
                        </label>
                        <input
                            type="password"
                            id="password"
                            className="form-input"
                            placeholder="Choose a password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`submit-button ${loading ? 'submit-button-loading' : ''}`}
                    >
                        {loading ? 'Registering...' : 'Register'}
                    </button>
                </form>

                <div className="login-link-container">
                    Already have an account? <a href="/login" className="login-link">Sign in</a>
                </div>

                <div className="info-text">
                    The password must contain at least 8 characters.<br />
                    Do not share your credentials with others.
                </div>
            </div>
        </div>
    );
}