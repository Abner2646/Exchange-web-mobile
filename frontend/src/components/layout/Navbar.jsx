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
  GiftIcon,
  ArrowTrendingUpIcon
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
  
  // Estado para el regalo BTC
  const [showGiftMessage, setShowGiftMessage] = useState(false);
  const [isClaimingGift, setIsClaimingGift] = useState(false);
  const [canClaimGift, setCanClaimGift] = useState(true);
  const [timeUntilNextClaim, setTimeUntilNextClaim] = useState('');

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

  // Auto-hide gift message después de 5 segundos
  useEffect(() => {
    if (showGiftMessage) {
      const timer = setTimeout(() => {
        setShowGiftMessage(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showGiftMessage]);

  // Verificar si puede reclamar el regalo (24 horas)
  useEffect(() => {
    const checkClaimAvailability = () => {
      const lastClaimTime = localStorage.getItem('lastBTCClaimTime');
      
      if (!lastClaimTime) {
        setCanClaimGift(true);
        setTimeUntilNextClaim('');
        return;
      }

      const lastClaim = new Date(parseInt(lastClaimTime));
      const now = new Date();
      const timeDiff = now - lastClaim;
      const hoursElapsed = timeDiff / (1000 * 60 * 60);

      if (hoursElapsed >= 24) {
        setCanClaimGift(true);
        setTimeUntilNextClaim('');
      } else {
        setCanClaimGift(false);
        const hoursRemaining = Math.ceil(24 - hoursElapsed);
        setTimeUntilNextClaim(`${hoursRemaining}h`);
      }
    };

    // Verificar inmediatamente
    checkClaimAvailability();

    // Verificar cada minuto
    const interval = setInterval(checkClaimAvailability, 60000);

    return () => clearInterval(interval);
  }, []);

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

  // Handler: Reclamar regalo BTC
  const handleClaimGift = async () => {
    if (isClaimingGift || !canClaimGift) return;
    
    try {
      setIsClaimingGift(true);
      
      const response = await fetch('http://localhost:3001/api/balances/reclamarBTC', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al reclamar el regalo');
      }

      const data = await response.json();
      console.log('[Navbar] Regalo reclamado:', data);
      
      // Guardar timestamp del reclamo
      localStorage.setItem('lastBTCClaimTime', Date.now().toString());
      
      // Actualizar estado de disponibilidad
      setCanClaimGift(false);
      setTimeUntilNextClaim('24h');
      
      // Mostrar mensaje de éxito
      setShowGiftMessage(true);
      
      // Recargar la página después de 1 segundo
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('[Navbar] Error claiming gift:', error);
      alert('Hubo un error al reclamar el regalo. Por favor, intenta de nuevo.');
      setIsClaimingGift(false);
    }
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

              <Link
                to="/trading"
                className={`navbar-link ${
                  isRouteActive(['/trading' /* Otros links acá */]) ? 'active' : ''
                }`}
              >
                <ArrowTrendingUpIcon className="navbar-link-icon" />
                Trading
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

                  {/* Botón Reclamar Regalo */}
                  <button
                    onClick={handleClaimGift}
                    disabled={isClaimingGift || !canClaimGift}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 1rem',
                      backgroundColor: !canClaimGift ? '#8C919A' : '#0052FF',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '0.625rem',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: (isClaimingGift || !canClaimGift) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      opacity: (isClaimingGift || !canClaimGift) ? 0.7 : 1,
                      boxShadow: !canClaimGift ? '0 2px 8px rgba(140, 145, 154, 0.2)' : '0 2px 8px rgba(0, 82, 255, 0.2)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isClaimingGift && canClaimGift) {
                        e.currentTarget.style.backgroundColor = '#0046E0';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 82, 255, 0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (canClaimGift) {
                        e.currentTarget.style.backgroundColor = '#0052FF';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 82, 255, 0.2)';
                      }
                    }}
                    title={!canClaimGift ? `Podrás reclamar nuevamente en ${timeUntilNextClaim}` : ''}
                  >
                    <GiftIcon style={{ width: '1.25rem', height: '1.25rem' }} />
                    {isClaimingGift 
                      ? 'Reclamando...' 
                      : !canClaimGift 
                        ? `Disponible en ${timeUntilNextClaim}` 
                        : 'Reclamar regalo'}
                  </button>

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

      {/* Mensaje de regalo reclamado */}
      {showGiftMessage && (
        <div
          style={{
            position: 'fixed',
            top: '5rem',
            right: '2rem',
            zIndex: 9999,
            backgroundColor: '#FFFFFF',
            color: '#050F19',
            padding: '1.25rem 1.5rem',
            borderRadius: '1rem',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            minWidth: '320px',
            border: '2px solid #0052FF',
            animation: 'slideInRight 0.3s ease-out',
          }}
        >
          <div
            style={{
              fontSize: '2rem',
              lineHeight: 1,
            }}
          >
            🎉
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: '1rem',
                fontWeight: '700',
                marginBottom: '0.25rem',
                color: '#050F19',
              }}
            >
              ¡Felicidades!
            </div>
            <div
              style={{
                fontSize: '0.875rem',
                color: '#5B616E',
              }}
            >
              Has reclamado 1 BTC de regalo 🎉
            </div>
          </div>
          <button
            onClick={() => setShowGiftMessage(false)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#8C919A',
              cursor: 'pointer',
              padding: '0.25rem',
              fontSize: '1.25rem',
              lineHeight: 1,
              fontWeight: '700',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#050F19';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#8C919A';
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Loading Overlay durante logout */}
      {isLoggingOut && (
        <div className="navbar-logout-overlay">
          <LoadingSpinner size="lg" message="Cerrando sesión..." />
        </div>
      )}

      {/* Keyframes para animación */}
      <style>
        {`
          @keyframes slideInRight {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}
      </style>
    </>
  );
};

export default Navbar;