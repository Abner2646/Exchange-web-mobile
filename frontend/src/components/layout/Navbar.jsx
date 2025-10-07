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
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const userDropdownRef = useRef(null);
  const notificationsDropdownRef = useRef(null);
  const userDropdownTimeoutRef = useRef(null);
  const notificationsDropdownTimeoutRef = useRef(null);

  const handleDepositar = () => {
    if (user) {
      navigate('/depositos');
    } else {
      navigate('/login');
    }
  };

  // Capitalizar nombre de usuario
  const capitalizeUsername = (username) => {
    return username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();
  };

  // Fetch notificaciones desde la API
  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/notificaciones/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Fetch contador de notificaciones no leídas
  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/notificaciones/me/unread-count', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  // Marcar todas como leídas
  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/notificaciones/me/mark-all-read', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        setUnreadCount(0);
        // Actualizar notificaciones localmente para marcar como leídas
        setNotifications(prev => prev.map(notif => ({ ...notif, leida: true })));
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  // Cargar notificaciones al abrir el dropdown
  useEffect(() => {
    if (isNotificationsDropdownOpen && user) {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [isNotificationsDropdownOpen, user]);

  // Cargar contador inicial
  useEffect(() => {
    if (user) {
      fetchUnreadCount();
    }
  }, [user]);

  // Handlers para hover con delay
  const handleUserMouseEnter = () => {
    if (userDropdownTimeoutRef.current) {
      clearTimeout(userDropdownTimeoutRef.current);
    }
    setIsUserDropdownOpen(true);
    setIsNotificationsDropdownOpen(false);
  };

  const handleUserMouseLeave = () => {
    userDropdownTimeoutRef.current = setTimeout(() => {
      setIsUserDropdownOpen(false);
    }, 300); // 300ms delay antes de cerrar
  };

  const handleNotificationsMouseEnter = () => {
    if (notificationsDropdownTimeoutRef.current) {
      clearTimeout(notificationsDropdownTimeoutRef.current);
    }
    setIsNotificationsDropdownOpen(true);
    setIsUserDropdownOpen(false);
  };

  const handleNotificationsMouseLeave = () => {
    notificationsDropdownTimeoutRef.current = setTimeout(() => {
      setIsNotificationsDropdownOpen(false);
    }, 300); // 300ms delay antes de cerrar
  };

  // Handlers para click
  const toggleUserDropdown = () => {
    setIsUserDropdownOpen(!isUserDropdownOpen);
    setIsNotificationsDropdownOpen(false);
  };

  const toggleNotificationsDropdown = () => {
    setIsNotificationsDropdownOpen(!isNotificationsDropdownOpen);
    setIsUserDropdownOpen(false);
  };

  // Formatear fecha de notificación
  const formatNotificationDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Hace unos minutos';
    } else if (diffInHours < 24) {
      return `Hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
    } else {
      return `Hace ${Math.floor(diffInHours / 24)} día${Math.floor(diffInHours / 24) > 1 ? 's' : ''}`;
    }
  };

  // Obtener icono según tipo de notificación
  const getNotificationIcon = (tipo) => {
    switch (tipo) {
      case 'deposito':
        return '💸';
      case 'seguridad':
        return '🛡️';
      case 'sistema':
        return '🔔';
      case 'transaccion':
        return '🔄';
      default:
        return '📢';
    }
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
                <span className="navbar-user-info">Hola, {capitalizeUsername(user.username)}</span>
                
                {/* Campana de Notificaciones */}
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
                      <span className="navbar-notifications-badge">{unreadCount}</span>
                    )}
                  </button>

                  {isNotificationsDropdownOpen && (
                    <div 
                      className="navbar-dropdown-menu navbar-notifications-menu"
                      onMouseEnter={handleNotificationsMouseEnter}
                      onMouseLeave={handleNotificationsMouseLeave}
                    >
                      <div className="navbar-notifications-header">
                        <h3>Notificaciones</h3>
                        {notifications.length > 0 && (
                          <button 
                            className="navbar-notifications-mark-read"
                            onClick={markAllAsRead}
                          >
                            Marcar todas como leídas
                          </button>
                        )}
                      </div>
                      
                      <div className="navbar-notifications-list">
                        {notifications.length > 0 ? (
                          notifications.slice(0, 5).map((notification) => (
                            <div 
                              key={notification.id} 
                              className={`navbar-notification-item ${notification.leida ? '' : 'navbar-notification-unread'}`}
                            >
                              <div className="navbar-notification-icon">
                                {getNotificationIcon(notification.tipo)}
                              </div>
                              <div className="navbar-notification-content">
                                <p>{notification.mensaje}</p>
                                <span>{formatNotificationDate(notification.fecha_creacion)}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="navbar-notification-empty">
                            No hay notificaciones
                          </div>
                        )}
                      </div>
                      
                      {notifications.length > 5 && (
                        <Link 
                          to="/notificaciones" 
                          className="navbar-notifications-view-all"
                          onClick={() => setIsNotificationsDropdownOpen(false)}
                        >
                          Ver todas las notificaciones
                        </Link>
                      )}
                    </div>
                  )}
                </div>

                {/* User Profile Dropdown */}
                <div 
                  className="navbar-dropdown navbar-user-dropdown" 
                  ref={userDropdownRef}
                  onMouseEnter={handleUserMouseEnter}
                  onMouseLeave={handleUserMouseLeave}
                >
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
                    <div 
                      className="navbar-dropdown-menu navbar-user-dropdown-menu"
                      onMouseEnter={handleUserMouseEnter}
                      onMouseLeave={handleUserMouseLeave}
                    >
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