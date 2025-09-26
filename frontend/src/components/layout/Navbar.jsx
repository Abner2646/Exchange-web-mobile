import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ThemeSwitcher from '../ThemeSwitcher';
import '../../styles/Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-content">
          <Link to="/" className="navbar-logo">
            BitFlow
          </Link>
          
          <div className="navbar-menu">
            <Link to="/swap" className="navbar-link">
              Swap
            </Link>
            <Link to="/p2p" className="navbar-link">
              P2P
            </Link>
            <Link to="/ordenes" className="navbar-link">
              Ordenes
            </Link>
            <Link to="/launchpad" className="navbar-link">
              Launchpad
            </Link>
            
            {/* Dropdown Más */}
            <div className="navbar-dropdown">
              <span className="navbar-link navbar-dropdown-trigger">
                Más
                <span className="navbar-dropdown-arrow">▼</span>
              </span>

              <div className="navbar-dropdown-menu">
                <Link to="/noticias" className="navbar-dropdown-item">
                  <span className="navbar-dropdown-icon">📰</span>
                  Noticias
                </Link>
                <Link to="/academia" className="navbar-dropdown-item">
                  <span className="navbar-dropdown-icon">🎓</span>
                  Academia
                </Link>
                <Link to="/soporte" className="navbar-dropdown-item">
                  <span className="navbar-dropdown-icon">🎧</span>
                  Soporte
                </Link>
              </div>
            </div>
          </div>

          <div className="navbar-actions">
            {/* Botón Depositar */}
            <button className="navbar-deposit-btn">
              Depositar
            </button>
            
            {user ? (
              <>
                <span className="navbar-user-info">Hola, {user.username}</span>
                
                {/* User Profile Dropdown */}
                <div className="navbar-dropdown navbar-user-dropdown">
                  <div className="navbar-user-profile-trigger">
                    <div className="navbar-user-avatar">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  </div>

                  <div className="navbar-dropdown-menu navbar-user-dropdown-menu">
                    <Link to="/activos" className="navbar-dropdown-item">
                      <span className="navbar-dropdown-icon">💼</span>
                      Activos
                    </Link>
                    <Link to="/configuracion" className="navbar-dropdown-item">
                      <span className="navbar-dropdown-icon">⚙️</span>
                      Configuración
                    </Link>
                    <div className="navbar-dropdown-divider"></div>
                    <div className="navbar-dropdown-logout">
                      <button
                        onClick={logout}
                        className="navbar-logout-btn"
                      >
                        <span className="navbar-dropdown-icon">🚪</span>
                        Cerrar Sesión
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <Link
                to="/login"
                className="navbar-login-btn"
              >
                Iniciar Sesión
              </Link>
            )}

            {/* Selector de tema - AL FINAL */}
            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;