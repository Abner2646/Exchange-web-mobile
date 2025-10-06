import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ThemeSwitcher from '../ThemeSwitcher';
import { 
  ArrowsRightLeftIcon, 
  UserGroupIcon, 
  ArrowDownTrayIcon,
  UserIcon,
  WalletIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon,
  BellIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import '../../styles/Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isNotificationsDropdownOpen, setIsNotificationsDropdownOpen] = useState(false);
  
  const userDropdownRef = useRef(null);
  const notificationsDropdownRef = useRef(null);

  const handleDepositar = () => {
    if (user) {
      navigate('/depositos');
    } else {
      navigate('/login');
    }
  };

  // Cerrar dropdowns al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setIsUserDropdownOpen(false);
      }
      if (notificationsDropdownRef.current && !notificationsDropdownRef.current.contains(event.target)) {
        setIsNotificationsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleUserDropdown = () => {
    setIsUserDropdownOpen(!isUserDropdownOpen);
    setIsNotificationsDropdownOpen(false); // Cerrar notificaciones si está abierto
  };

  const toggleNotificationsDropdown = () => {
    setIsNotificationsDropdownOpen(!isNotificationsDropdownOpen);
    setIsUserDropdownOpen(false); // Cerrar usuario si está abierto
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-content">
          <Link to="/" className="navbar-logo">
            BitFlow
          </Link>
          
          <div className="navbar-menu">
            <Link to="/swap" className="navbar-link">
              <ArrowsRightLeftIcon className="navbar-link-icon" />
              Swap
            </Link>
            <Link to="/p2p" className="navbar-link">
              <UserGroupIcon className="navbar-link-icon" />
              P2P
            </Link>
          </div>

          <div className="navbar-actions">
            {/* Botón Depositar */}
            <button 
              className="navbar-deposit-btn" 
              onClick={handleDepositar}
            >
              <ArrowDownTrayIcon className="navbar-deposit-icon" />
              Depositar
            </button>
            
            {user ? (
              <>
                <span className="navbar-user-info">Hola, {user.username}</span>
                
                {/* Campana de Notificaciones */}
                <div className="navbar-dropdown navbar-notifications-dropdown" ref={notificationsDropdownRef}>
                  <button 
                    className="navbar-notifications-trigger"
                    onClick={toggleNotificationsDropdown}
                  >
                    <BellIcon className="navbar-notifications-icon" />
                    <span className="navbar-notifications-badge">3</span>
                  </button>

                  {isNotificationsDropdownOpen && (
                    <div className="navbar-dropdown-menu navbar-notifications-menu">
                      <div className="navbar-notifications-header">
                        <h3>Notificaciones</h3>
                        <span className="navbar-notifications-count">3 nuevas</span>
                      </div>
                      
                      <div className="navbar-notifications-list">
                        <div className="navbar-notification-item">
                          <div className="navbar-notification-icon">💸</div>
                          <div className="navbar-notification-content">
                            <p>Depósito completado (Mock)</p>
                            <span>Hace 5 min</span>
                          </div>
                        </div>
                        
                        <div className="navbar-notification-item">
                          <div className="navbar-notification-icon">🔔</div>
                          <div className="navbar-notification-content">
                            <p>Nueva actualización disponible</p>
                            <span>Hace 1 hora</span>
                          </div>
                        </div>
                        
                        <div className="navbar-notification-item">
                          <div className="navbar-notification-icon">🛡️</div>
                          <div className="navbar-notification-content">
                            <p>Verificación de seguridad requerida</p>
                            <span>Ayer</span>
                          </div>
                        </div>
                      </div>
                      
                      <Link to="/notificaciones" className="navbar-notifications-view-all">
                        Ver todas las notificaciones
                      </Link>
                    </div>
                  )}
                </div>

                {/* User Profile Dropdown */}
                <div className="navbar-dropdown navbar-user-dropdown" ref={userDropdownRef}>
                  <button 
                    className="navbar-user-profile-trigger"
                    onClick={toggleUserDropdown}
                  >
                    <div className="navbar-user-avatar">
                      <UserIcon className="navbar-user-avatar-icon" />
                    </div>
                    <ChevronDownIcon className="navbar-user-dropdown-arrow" />
                  </button>

                  {isUserDropdownOpen && (
                    <div className="navbar-dropdown-menu navbar-user-dropdown-menu">
                      <Link 
                        to="/activos" 
                        className="navbar-dropdown-item"
                        onClick={() => setIsUserDropdownOpen(false)}
                      >
                        <WalletIcon className="navbar-dropdown-icon" />
                        Activos
                      </Link>
                      <Link 
                        to="/perfil" 
                        className="navbar-dropdown-item"
                        onClick={() => setIsUserDropdownOpen(false)}
                      >
                        <Cog6ToothIcon className="navbar-dropdown-icon" />
                        Configuración
                      </Link>
                      <div className="navbar-dropdown-divider"></div>
                      <div className="navbar-dropdown-logout">
                        <button
                          onClick={() => {
                            logout();
                            setIsUserDropdownOpen(false);
                          }}
                          className="navbar-logout-btn"
                        >
                          <ArrowLeftOnRectangleIcon className="navbar-dropdown-icon" />
                          Cerrar Sesión
                        </button>
                      </div>
                    </div>
                  )}
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