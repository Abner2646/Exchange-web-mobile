import { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../styles/home.css';

export default function Home() {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const [userInfo, setUserInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    // Function to decode JWT and obtain user information
    const decodeJWT = (token) => {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (error) {
            console.error('Error decoding JWT:', error);
            return null;
        }
    };

    // Function to get the current token
    const getCurrentToken = () => {
        // First try to get from localStorage (if it exists)
        let token = localStorage.getItem('token');
        
        // If not in localStorage, try extracting cookies
        if (!token) {
            const cookies = document.cookie.split(';');
            const tokenCookie = cookies.find(cookie => cookie.trim().startsWith('token='));
            if (tokenCookie) {
                token = tokenCookie.split('=')[1];
            }
        }
        
        return token;
    };

    // Function to capitalize the first letter of the username
    const capitalizeFirstLetter = (string) => {
        if (!string) return '';
        return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
    };

    // Load initial user information
    useEffect(() => {
        const loadUserInfo = async () => {
            try {
                const token = getCurrentToken();
                if (token) {
                    const decoded = decodeJWT(token);
                    setUserInfo(decoded);
                }
            } catch (error) {
                console.error('Error loading user information:', error);
            } finally {
                setLoading(false);
            }
        };

        loadUserInfo();
    }, []);

    if (!user) {
        navigate('/login');
        return null;
    }

    if (loading) {
        return <div className="loading">Charging...</div>;
    }

    // Check if companyId exists in the decoded JWT
    const hasCompany = userInfo && (userInfo.companyId);

    return (
        <div className="home-container">
            <div className="home-header">
                <h1>Welcome to your Dashboard</h1>
                <p className="user-greeting">Welcome, {capitalizeFirstLetter(user.username)}! 👋</p>
            </div>
            
            {!hasCompany && (
                <div className="warning-banner">
                    ⚠️ You must configure your company to access all functions
                </div>
            )}
            
            <div className="features-grid">
                <div className="feature-card">
                    <div className="feature-icon">📦</div>
                    <h3>Products</h3>
                    <p>Manage your product inventory</p>
                    <button 
                        onClick={() => navigate('/products')}
                        disabled={!hasCompany}
                        className={!hasCompany ? 'disabled-button' : 'action-button primary-action'}
                    >
                        {!hasCompany ? '🔒 Acceder' : 'Manage →'}
                    </button>
                </div>
                
                <div className="feature-card">
                    <div className="feature-icon">🏷️</div>
                    <h3>Categories</h3>
                    <p>Organize your products by categories</p>
                    <button 
                        onClick={() => navigate('/categories')}
                        disabled={!hasCompany}
                        className={!hasCompany ? 'disabled-button' : 'action-button primary-action'}
                    >
                        {!hasCompany ? '🔒 Acceder' : 'Manage →'}
                    </button>
                </div>
                
                <div className="feature-card">
                    <div className="feature-icon">📊</div>
                    <h3>Transactions</h3>
                    <p>Your check-in and check-out records</p>
                    <button 
                        onClick={() => navigate('/transactions')}
                        disabled={!hasCompany}
                        className={!hasCompany ? 'disabled-button' : 'action-button primary-action'}
                    >
                        {!hasCompany ? '🔒 Acceder' : 'View history →'}
                    </button>
                </div>
                
                <div className="feature-card">
                    <div className="feature-icon">🏢</div>
                    <h3>My Company</h3>
                    <p>Configure your business data</p>
                    <button 
                        onClick={() => navigate('/company')}
                        className="action-button secondary-action"
                    >
                        Set up →
                    </button>
                </div>
            </div>
            
            <div className="logout-section">
                <button 
                    className="logout-button" 
                    onClick={() => { 
                        logout(); 
                        navigate('/login'); 
                    }}
                >
                    👋 Log out
                </button>
            </div>
        </div>
    );
}