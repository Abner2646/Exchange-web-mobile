import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../styles/login.css';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('http://localhost:3001/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username: username.toLowerCase(), 
                    password 
                }),
            });
            
            if (!res.ok) throw new Error('Login failed');
            
            const data = await res.json();
            
            // Save the token to localStorage
            localStorage.setItem('token', data.token);
            
            // Save user data
            login({ id: data.user.id, username: data.user.username });
            
            navigate('/');
        } catch (error) {
            console.error('Login error:', error);
            const errorMessage = "Incorrect username or password. Please try again.";
            const messageBox = document.createElement('div');
            messageBox.className = 'login-error-message-box';
            messageBox.textContent = errorMessage;
            document.body.appendChild(messageBox);
            setTimeout(() => {
                if (document.body.contains(messageBox)) { // Check if the item still exists before attempting to remove it
                    document.body.removeChild(messageBox);
                }
            }, 3000);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        setGoogleLoading(true);
        // Redirect to the OAuth endpoint on the backend
        window.location.href = 'http://localhost:3001/auth/google';
    };

    return (
        <div id="login-page-container">
            <div className="login-form-card">
                <h1 className="login-title">
                    Login
                </h1>

                
                {/* Google Button - Added before the form */}
                <div className="login-google-section">
                    <button 
                        onClick={handleGoogleLogin}
                        disabled={googleLoading}
                        className={`login-google-button ${googleLoading ? 'login-google-button-loading' : ''}`}
                        type="button"
                    >
                        <svg className="login-google-icon" viewBox="0 0 24 24" width="20" height="20">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        {googleLoading ? 'Connecting...' : 'Continue with Google'}
                    </button>
                    
                    <div className="login-divider">
                        <span className="login-divider-text">or</span>
                    </div>
                </div>
                
                <form onSubmit={handleSubmit}>
                    <div className="login-form-group">
                        <label htmlFor="login-username-input" className="login-label">
                            Usuario *
                        </label>
                        <input
                            type="text"
                            id="login-username-input"
                            className="login-input"
                            placeholder="Enter your username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>

                    <div className="login-form-group">
                        <label htmlFor="login-password-input" className="login-label">
                            Password *
                        </label>
                        <input
                            type="password"
                            id="login-password-input"
                            className="login-input"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className={`login-submit-button ${loading ? 'login-submit-button-loading' : ''}`}
                    >
                        {loading ? 'Logging in...' : 'Log in'}
                    </button>
                </form>

                <div className="login-register-link-container">
                    You don't have an account? <a href="/register" className="login-register-link">Sign up</a>
                </div>
            </div>
        </div>
    );
}