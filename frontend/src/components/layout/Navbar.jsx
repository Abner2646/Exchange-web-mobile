// src/components/layout/Navbar.jsx
import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useNotifications from '../../hooks/useNotifications';
import ThemeSwitcher from '../ThemeSwitcher';
import NotificationsDropdown from '../features/NotificationsDropdown';
import UserDropdown from '../features/UserDropdown';
import WalletDropdown from '../features/WalletDropdown';
import LoadingSpinner from '../common/LoadingSpinner';
import {
  ArrowsRightLeftIcon,
  UserGroupIcon,
  UserIcon,
  BellIcon,
  ChevronDownIcon,
  WalletIcon,
  ArrowDownCircleIcon,
} from '@heroicons/react/24/outline';
import '../../styles/Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Dropdowns state
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isNotificationsDropdownOpen, setIsNotificationsDropdownOpen] = useState(false);
  const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Refs para dropdowns
  const userDropdownRef = useRef(null);
  const notificationsDropdownRef = useRef(null);
  const walletDropdownRef = useRef(null);

  // Timeouts para hover
  const userDropdownTimeoutRef = useRef(null);
  const notificationsDropdownTimeoutRef = useRef(null);
  const walletDropdownTimeoutRef = useRef(null);

  // Hook de notificaciones
  const {
    notifications,
    unreadCount,
    isLoading: notificationsLoading,
    markAllAsRead,
    refetchNotifications,
    refetchUnreadCount,
  } = useNotifications();

  // Auto-refresh unread count cada 60 segundos
  useEffect(() => {
    if (user) {
      const interval = setInterval(() => {
        refetchUnreadCount();
      }, 60000);

      return () => clearInterval(interval);
    }
  }, [user, refetchUnreadCount]);

  // Fetch notificaciones cuando se abre el dropdown
  useEffect(() => {
    if (isNotificationsDropdownOpen && user) {
      refetchNotifications();
      refetchUnreadCount();
    }
  }, [isNotificationsDropdownOpen, user, refetchNotifications, refetchUnreadCount]);

  // Helper: Verificar si la ruta está activa
  const isRouteActive = (routes) => {
    if (typeof routes === 'string') {
      return location.pathname === routes;
    }
    // Si es array, verificar si alguna ruta coincide
    return routes.some((route) => location.pathname.startsWith(route));
  };

  // Helper: Capitalizar username
  const capitalizeUsername = (username) => {
    if (!username) return 'Usuario';
    return username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();
  };

  // Handler: Logout con loading
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      navigate('/');
    } catch (error) {
      console.error('[Navbar] Error logging out:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Handler: Mark all as read
  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  // ========== USER DROPDOWN HANDLERS ==========

  const handleUserMouseEnter = () => {
    if (userDropdownTimeoutRef.current) {
      clearTimeout(userDropdownTimeoutRef.current);
    }
    setIsUserDropdownOpen(true);
    setIsNotificationsDropdownOpen(false);
    setIsWalletDropdownOpen(false);
  };

  const handleUserMouseLeave = () => {
    userDropdownTimeoutRef.current = setTimeout(() => {
      setIsUserDropdownOpen(false);
    }, 300);
  };

  const toggleUserDropdown = () => {
    setIsUserDropdownOpen(!isUserDropdownOpen);
    setIsNotificationsDropdownOpen(false);
    setIsWalletDropdownOpen(false);
  };

  // ========== NOTIFICATIONS DROPDOWN HANDLERS ==========

  const handleNotificationsMouseEnter = () => {
    if (notificationsDropdownTimeoutRef.current) {
      clearTimeout(notificationsDropdownTimeoutRef.current);
    }
    setIsNotificationsDropdownOpen(true);
    setIsUserDropdownOpen(false);
    setIsWalletDropdownOpen(false);
  };

  const handleNotificationsMouseLeave = () => {
    notificationsDropdownTimeoutRef.current = setTimeout(() => {
      setIsNotificationsDropdownOpen(false);
    }, 300);
  };

  const toggleNotificationsDropdown = () => {
    const newState = !isNotificationsDropdownOpen;
    setIsNotificationsDropdownOpen(newState);
    setIsUserDropdownOpen(false);
    setIsWalletDropdownOpen(false);

    if (newState && user) {
      refetchNotifications();
      refetchUnreadCount();
    }
  };

  // ========== WALLET DROPDOWN HANDLERS ==========

  const handleWalletMouseEnter = () => {
    if (walletDropdownTimeoutRef.current) {
      clearTimeout(walletDropdownTimeoutRef.current);
    }
    setIsWalletDropdownOpen(true);
    setIsUserDropdownOpen(false);
    setIsNotificationsDropdownOpen(false);
  };

  const handleWalletMouseLeave = () => {
    walletDropdownTimeoutRef.current = setTimeout(() => {
      setIsWalletDropdownOpen(false);
    }, 300);
  };

  const toggleWalletDropdown = () => {
    setIsWalletDropdownOpen(!isWalletDropdownOpen);
    setIsUserDropdownOpen(false);
    setIsNotificationsDropdownOpen(false);
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-container">
          <div className="navbar-content">
            {/* Logo */}
            <Link to="/" className="navbar-logo">
              BitFlow
            </Link>

            {/* Menu de navegación - Solo desktop */}
            <div className="navbar-menu">
              <Link
                to="/swap"
                className={`navbar-link ${isRouteActive('/swap') ? 'active' : ''}`}
              >
                <ArrowsRightLeftIcon className="navbar-link-icon" />
                Swap
              </Link>

              <Link
                to="/p2p"
                className={`navbar-link ${
                  isRouteActive(['/p2p', '/p2p/misOfertas', '/p2p/crear']) ? 'active' : ''
                }`}
              >
                <UserGroupIcon className="navbar-link-icon" />
                P2P
              </Link>

              {/* Wallet Dropdown - Solo si está autenticado */}
              {user && (
                <div
                  className="navbar-dropdown navbar-wallet-dropdown"
                  ref={walletDropdownRef}
                  onMouseEnter={handleWalletMouseEnter}
                  onMouseLeave={handleWalletMouseLeave}
                >
                  <button
                    className={`navbar-link navbar-wallet-trigger ${
                      isRouteActive(['/activos', '/depositos', '/retiros', '/transferir'])
                        ? 'active'
                        : ''
                    }`}
                    onClick={toggleWalletDropdown}
                  >
                    <WalletIcon className="navbar-link-icon" />
                    Wallet
                    <ChevronDownIcon className="navbar-dropdown-arrow" />
                  </button>

                  {isWalletDropdownOpen && (
                    <WalletDropdown
                      onClose={() => setIsWalletDropdownOpen(false)}
                      onMouseEnter={handleWalletMouseEnter}
                      onMouseLeave={handleWalletMouseLeave}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Acciones - Desktop */}
            <div className="navbar-actions">
              {user ? (
                <>
                  <span className="navbar-user-info">
                    Hola, {capitalizeUsername(user?.username)}
                  </span>

                  {/* Notifications Dropdown */}
                  <div
                    className="navbar-dropdown navbar-notifications-dropdown"
                    ref={notificationsDropdownRef}
                    onMouseEnter={handleNotificationsMouseEnter}
                    onMouseLeave={handleNotificationsMouseLeave}
                  >
                    <button
                      className="navbar-notifications-trigger"
                      onClick={toggleNotificationsDropdown}
                    >
                      <BellIcon className="navbar-notifications-icon" />
                      {unreadCount > 0 && (
                        <span className="navbar-notifications-badge">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </button>

                    {isNotificationsDropdownOpen && (
                      <NotificationsDropdown
                        notifications={notifications}
                        unreadCount={unreadCount}
                        isLoading={notificationsLoading}
                        onMarkAllAsRead={handleMarkAllAsRead}
                        onClose={() => setIsNotificationsDropdownOpen(false)}
                        onMouseEnter={handleNotificationsMouseEnter}
                        onMouseLeave={handleNotificationsMouseLeave}
                      />
                    )}
                  </div>

                  {/* User Dropdown */}
                  <div
                    className="navbar-dropdown navbar-user-dropdown"
                    ref={userDropdownRef}
                    onMouseEnter={handleUserMouseEnter}
                    onMouseLeave={handleUserMouseLeave}
                  >
                    <button className="navbar-user-profile-trigger" onClick={toggleUserDropdown}>
                      <div className="navbar-user-avatar">
                        <UserIcon className="navbar-user-avatar-icon" />
                      </div>
                      <ChevronDownIcon className="navbar-user-dropdown-arrow" />
                    </button>

                    {isUserDropdownOpen && (
                      <UserDropdown
                        onLogout={handleLogout}
                        onClose={() => setIsUserDropdownOpen(false)}
                        onMouseEnter={handleUserMouseEnter}
                        onMouseLeave={handleUserMouseLeave}
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className="navbar-auth-buttons">
                  <Link to="/login" className="navbar-login-btn">
                    Iniciar Sesión
                  </Link>
                  <Link to="/register" className="navbar-register-btn">
                    Registrarte
                  </Link>
                </div>
              )}

              <ThemeSwitcher />
            </div>

            {/* Mobile: Solo logo + botón app */}
            <div className="navbar-mobile-actions">
              <Link to="/download-app" className="navbar-download-app-btn">
                <ArrowDownCircleIcon className="navbar-download-app-icon" />
                Descargar App
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Loading Overlay durante logout */}
      {isLoggingOut && (
        <div className="navbar-logout-overlay">
          <LoadingSpinner size="lg" message="Cerrando sesión..." />
        </div>
      )}
    </>
  );
};

export default Navbar;