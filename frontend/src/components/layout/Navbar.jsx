// src/components/layout/Navbar.jsx
import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useNotifications from '../../hooks/useNotifications';
import ThemeSwitcher from '../ThemeSwitcher';
import NotificationsDropdown from '../features/NotificationsDropdown';
import UserDropdown from '../features/UserDropdown';
import {
  ArrowsRightLeftIcon,
  UserGroupIcon,
  ArrowDownTrayIcon,
  UserIcon,
  BellIcon,
  ChevronDownIcon,
  ChartBarIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';
import '../../styles/Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Dropdowns state
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isNotificationsDropdownOpen, setIsNotificationsDropdownOpen] = useState(false);
  const [isTradingDropdownOpen, setIsTradingDropdownOpen] = useState(false);

  // Refs para dropdowns
  const userDropdownRef = useRef(null);
  const notificationsDropdownRef = useRef(null);
  const tradingDropdownRef = useRef(null);

  // Timeouts para hover
  const userDropdownTimeoutRef = useRef(null);
  const notificationsDropdownTimeoutRef = useRef(null);
  const tradingDropdownTimeoutRef = useRef(null);

  // Hook de notificaciones (reutiliza lógica existente)
  const {
    notifications,
    unreadCount,
    isLoading: notificationsLoading,
    markAllAsRead,
    refetchNotifications,
    refetchUnreadCount,
  } = useNotifications();

  console.log('[Navbar] Component state:', {
    user: user?.username,
    notificationsCount: notifications.length,
    unreadCount,
    isNotificationsDropdownOpen,
  });

  // Auto-refresh unread count cada 60 segundos
  useEffect(() => {
    if (user) {
      const interval = setInterval(() => {
        console.log('[Navbar] Auto-refreshing unread count');
        refetchUnreadCount();
      }, 60000); // 60 segundos

      return () => clearInterval(interval);
    }
  }, [user, refetchUnreadCount]);

  // Fetch notificaciones cuando se abre el dropdown
  useEffect(() => {
    if (isNotificationsDropdownOpen && user) {
      console.log('[Navbar] Dropdown opened, fetching notifications');
      refetchNotifications();
      refetchUnreadCount();
    }
  }, [isNotificationsDropdownOpen, user, refetchNotifications, refetchUnreadCount]);

  // Handlers
  const handleDepositar = () => {
    if (user) {
      navigate('/depositos');
    } else {
      navigate('/login');
    }
  };

  const capitalizeUsername = (username) => {
    if (!username) return 'Usuario';
    return username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();
  };

  const handleMarkAllAsRead = () => {
    console.log('[Navbar] Mark all as read clicked');
    markAllAsRead();
  };

  // ========== USER DROPDOWN HANDLERS ==========

  const handleUserMouseEnter = () => {
    if (userDropdownTimeoutRef.current) {
      clearTimeout(userDropdownTimeoutRef.current);
    }
    setIsUserDropdownOpen(true);
    setIsNotificationsDropdownOpen(false);
    setIsTradingDropdownOpen(false);
  };

  const handleUserMouseLeave = () => {
    userDropdownTimeoutRef.current = setTimeout(() => {
      setIsUserDropdownOpen(false);
    }, 300);
  };

  const toggleUserDropdown = () => {
    setIsUserDropdownOpen(!isUserDropdownOpen);
    setIsNotificationsDropdownOpen(false);
    setIsTradingDropdownOpen(false);
  };

  // ========== NOTIFICATIONS DROPDOWN HANDLERS ==========

  const handleNotificationsMouseEnter = () => {
    if (notificationsDropdownTimeoutRef.current) {
      clearTimeout(notificationsDropdownTimeoutRef.current);
    }
    setIsNotificationsDropdownOpen(true);
    setIsUserDropdownOpen(false);
    setIsTradingDropdownOpen(false);
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
    setIsTradingDropdownOpen(false);

    if (newState && user) {
      refetchNotifications();
      refetchUnreadCount();
    }
  };

  // ========== TRADING DROPDOWN HANDLERS ==========

  const handleTradingMouseEnter = () => {
    if (tradingDropdownTimeoutRef.current) {
      clearTimeout(tradingDropdownTimeoutRef.current);
    }
    setIsTradingDropdownOpen(true);
    setIsUserDropdownOpen(false);
    setIsNotificationsDropdownOpen(false);
  };

  const handleTradingMouseLeave = () => {
    tradingDropdownTimeoutRef.current = setTimeout(() => {
      setIsTradingDropdownOpen(false);
    }, 300);
  };

  const toggleTradingDropdown = () => {
    const newState = !isTradingDropdownOpen;
    setIsTradingDropdownOpen(newState);
    setIsUserDropdownOpen(false);
    setIsNotificationsDropdownOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-content">
          {/* Logo */}
          <Link to="/" className="navbar-logo">
            BitFlow
          </Link>

          {/* Menu de navegación */}
          <div className="navbar-menu">
            <Link to="/swap" className="navbar-link">
              <ArrowsRightLeftIcon className="navbar-link-icon" />
              Swap
            </Link>
            <Link to="/p2p" className="navbar-link">
              <UserGroupIcon className="navbar-link-icon" />
              P2P
            </Link>

            {/* Trading Dropdown */}
            <div
              className="navbar-dropdown"
              ref={tradingDropdownRef}
              onMouseEnter={handleTradingMouseEnter}
              onMouseLeave={handleTradingMouseLeave}
            >
              <div className="navbar-link" style={{ cursor: 'default' }}>
                <ChartBarIcon className="navbar-link-icon" />
                Trading*
              </div>

              {isTradingDropdownOpen && (
                <div
                  className="navbar-dropdown-menu"
                  onMouseEnter={handleTradingMouseEnter}
                  onMouseLeave={handleTradingMouseLeave}
                  style={{ minWidth: '220px' }}
                >
                  <div className="navbar-dropdown-item" style={{ cursor: 'default', opacity: 0.7 }}>
                    Funcionalidad en desarrollo
                  </div>
                </div>
              )}
            </div>

            <Link to="/transferir" className="navbar-link">
              <ArrowUpTrayIcon className="navbar-link-icon" />
              Transferir
            </Link>
          </div>

          {/* Acciones */}
          <div className="navbar-actions">
            <button className="navbar-deposit-btn" onClick={handleDepositar}>
              <ArrowDownTrayIcon className="navbar-deposit-icon" />
              Depositar
            </button>

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
                      onLogout={logout}
                      onClose={() => setIsUserDropdownOpen(false)}
                      onMouseEnter={handleUserMouseEnter}
                      onMouseLeave={handleUserMouseLeave}
                    />
                  )}
                </div>
              </>
            ) : (
              <Link to="/login" className="navbar-login-btn">
                Iniciar Sesión
              </Link>
            )}

            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;