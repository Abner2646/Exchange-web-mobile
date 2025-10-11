"use client"

import { useState, useRef, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import ThemeSwitcher from "../ThemeSwitcher"
import {
  ArrowsRightLeftIcon,
  UserGroupIcon,
  ArrowDownTrayIcon,
  UserIcon,
  WalletIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon,
  BellIcon,
  ChevronDownIcon,
  CheckIcon,
  EyeIcon,
  ShieldCheckIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ArrowUpTrayIcon,
} from "@heroicons/react/24/outline"
import "../../styles/Navbar.css"

const API_URL = REACT_APP_API_URL

const Navbar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false)
  const [isNotificationsDropdownOpen, setIsNotificationsDropdownOpen] = useState(false)
  const [isTradingDropdownOpen, setIsTradingDropdownOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationsLoading, setNotificationsLoading] = useState(false)

  const userDropdownRef = useRef(null)
  const notificationsDropdownRef = useRef(null)
  const tradingDropdownRef = useRef(null)
  const userDropdownTimeoutRef = useRef(null)
  const notificationsDropdownTimeoutRef = useRef(null)
  const tradingDropdownTimeoutRef = useRef(null)

  const handleDepositar = () => {
    if (user) {
      navigate("/depositos")
    } else {
      navigate("/login")
    }
  }

  const capitalizeUsername = (username) => {
    return username.charAt(0).toUpperCase() + username.slice(1).toLowerCase()
  }

  const getToken = () => {
    try {
      return localStorage.getItem("token") || sessionStorage.getItem("token")
    } catch (error) {
      console.error("Error getting token:", error)
      return null
    }
  }

  const fetchNotifications = async () => {
    if (!user) return

    setNotificationsLoading(true)
    try {
      const token = getToken()
      if (!token) {
        console.error("No token found")
        return
      }

      const response = await fetch(`${API_URL}notificaciones/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      })

      if (response.status === 401) {
        console.error("Unauthorized - token may be invalid")
        return
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const notificacionesArray = data.notificaciones || data || []
      setNotifications(Array.isArray(notificacionesArray) ? notificacionesArray : [])
    } catch (error) {
      console.error("Error fetching notifications:", error)
    } finally {
      setNotificationsLoading(false)
    }
  }

  const fetchUnreadCount = async () => {
    if (!user) return

    try {
      const token = getToken()
      if (!token) {
        console.error("No token found for unread count")
        return
      }

      const response = await fetch("https://localhost:3001/api/notificaciones/me/unread-count", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      })

      if (response.status === 401) {
        console.error("Unauthorized - token may be invalid")
        return
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setUnreadCount(data.unreadCount || data.count || 0)
    } catch (error) {
      console.error("Error fetching unread count:", error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const token = getToken()
      if (!token) return

      const response = await fetch("https://localhost:3001/api/notificaciones/me/mark-all-read", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      })

      if (response.ok) {
        setUnreadCount(0)
        setNotifications((prev) => prev.map((notif) => ({ ...notif, leida: true })))
      }
    } catch (error) {
      console.error("Error marking notifications as read:", error)
    }
  }

  useEffect(() => {
    if (isNotificationsDropdownOpen && user) {
      fetchNotifications()
      fetchUnreadCount()
    }
  }, [isNotificationsDropdownOpen, user])

  useEffect(() => {
    if (user) {
      fetchUnreadCount()

      const interval = setInterval(fetchUnreadCount, 60000)
      return () => clearInterval(interval)
    }
  }, [user])

  const handleUserMouseEnter = () => {
    if (userDropdownTimeoutRef.current) {
      clearTimeout(userDropdownTimeoutRef.current)
    }
    setIsUserDropdownOpen(true)
    setIsNotificationsDropdownOpen(false)
    setIsTradingDropdownOpen(false)
  }

  const handleUserMouseLeave = () => {
    userDropdownTimeoutRef.current = setTimeout(() => {
      setIsUserDropdownOpen(false)
    }, 300)
  }

  const handleNotificationsMouseEnter = () => {
    if (notificationsDropdownTimeoutRef.current) {
      clearTimeout(notificationsDropdownTimeoutRef.current)
    }
    setIsNotificationsDropdownOpen(true)
    setIsUserDropdownOpen(false)
    setIsTradingDropdownOpen(false)
  }

  const handleNotificationsMouseLeave = () => {
    notificationsDropdownTimeoutRef.current = setTimeout(() => {
      setIsNotificationsDropdownOpen(false)
    }, 300)
  }

  const handleTradingMouseEnter = () => {
    if (tradingDropdownTimeoutRef.current) {
      clearTimeout(tradingDropdownTimeoutRef.current)
    }
    setIsTradingDropdownOpen(true)
    setIsUserDropdownOpen(false)
    setIsNotificationsDropdownOpen(false)
  }

  const handleTradingMouseLeave = () => {
    tradingDropdownTimeoutRef.current = setTimeout(() => {
      setIsTradingDropdownOpen(false)
    }, 300)
  }

  const toggleUserDropdown = () => {
    setIsUserDropdownOpen(!isUserDropdownOpen)
    setIsNotificationsDropdownOpen(false)
    setIsTradingDropdownOpen(false)
  }

  const toggleNotificationsDropdown = () => {
    const newState = !isNotificationsDropdownOpen
    setIsNotificationsDropdownOpen(newState)
    setIsUserDropdownOpen(false)
    setIsTradingDropdownOpen(false)

    if (newState && user) {
      fetchNotifications()
      fetchUnreadCount()
    }
  }

  const toggleTradingDropdown = () => {
    const newState = !isTradingDropdownOpen
    setIsTradingDropdownOpen(newState)
    setIsUserDropdownOpen(false)
    setIsNotificationsDropdownOpen(false)
  }

  const formatNotificationDate = (dateInput) => {
    if (!dateInput) {
      return "Fecha desconocida"
    }

    try {
      const date = new Date(dateInput)

      if (isNaN(date.getTime())) {
        return "Fecha desconocida"
      }

      const now = new Date()
      const diffInMs = now - date
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

      if (diffInMinutes < 1) return "Ahora mismo"
      if (diffInMinutes < 60) return `Hace ${diffInMinutes} minuto${diffInMinutes > 1 ? "s" : ""}`
      if (diffInHours < 24) return `Hace ${diffInHours} hora${diffInHours > 1 ? "s" : ""}`
      if (diffInDays < 7) return `Hace ${diffInDays} día${diffInDays > 1 ? "s" : ""}`

      return date.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    } catch (error) {
      console.error("Error formateando fecha:", error, "Input:", dateInput)
      return "Fecha desconocida"
    }
  }

  const getNotificationIcon = (tipo) => {
    const iconClass = "navbar-notification-custom-icon"

    switch (tipo) {
      case "deposito":
        return <BanknotesIcon className={iconClass} />
      case "seguridad":
        return <ShieldCheckIcon className={iconClass} />
      case "sistema":
        return <Cog6ToothIcon className={iconClass} />
      case "transaccion":
        return <ArrowsRightLeftIcon className={iconClass} />
      case "p2p":
        return <UserGroupIcon className={iconClass} />
      case "swap":
        return <ArrowsRightLeftIcon className={iconClass} />
      default:
        return <ExclamationTriangleIcon className={iconClass} />
    }
  }

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
            <div
              className="navbar-dropdown"
              ref={tradingDropdownRef}
              onMouseEnter={handleTradingMouseEnter}
              onMouseLeave={handleTradingMouseLeave}
            >
              <div className="navbar-link" style={{ cursor: "default" }}>
                <ChartBarIcon className="navbar-link-icon" />
                Trading*
              </div>

              {isTradingDropdownOpen && (
                <div
                  className="navbar-dropdown-menu"
                  onMouseEnter={handleTradingMouseEnter}
                  onMouseLeave={handleTradingMouseLeave}
                  style={{ minWidth: "220px" }}
                >
                  <div className="navbar-dropdown-item" style={{ cursor: "default", opacity: 0.7 }}>
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

          <div className="navbar-actions">
            <button className="navbar-deposit-btn" onClick={handleDepositar}>
              <ArrowDownTrayIcon className="navbar-deposit-icon" />
              Depositar
            </button>

            {user ? (
              <>
                <span className="navbar-user-info">Hola, {capitalizeUsername(user.username)}</span>

                <div
                  className="navbar-dropdown navbar-notifications-dropdown"
                  ref={notificationsDropdownRef}
                  onMouseEnter={handleNotificationsMouseEnter}
                  onMouseLeave={handleNotificationsMouseLeave}
                >
                  <button className="navbar-notifications-trigger" onClick={toggleNotificationsDropdown}>
                    <BellIcon className="navbar-notifications-icon" />
                    {unreadCount > 0 && (
                      <span className="navbar-notifications-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
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
                        {unreadCount > 0 && (
                          <button
                            className="navbar-notifications-mark-read"
                            onClick={markAllAsRead}
                            title="Marcar todas como leídas"
                          >
                            <CheckIcon className="navbar-notifications-mark-read-icon" />
                          </button>
                        )}
                      </div>

                      <div className="navbar-notifications-list">
                        {notificationsLoading ? (
                          <div className="navbar-notification-loading">Cargando notificaciones...</div>
                        ) : notifications.length > 0 ? (
                          notifications.slice(0, 5).map((notification) => (
                            <div
                              key={notification.id}
                              className={`navbar-notification-item ${!notification.leida ? "navbar-notification-unread" : ""}`}
                            >
                              <div className="navbar-notification-icon-wrapper">
                                {getNotificationIcon(notification.tipo)}
                              </div>
                              <div className="navbar-notification-content">
                                <p className="navbar-notification-title">{notification.titulo}</p>
                                <p className="navbar-notification-message">{notification.mensaje}</p>
                                <span className="navbar-notification-time">
                                  {formatNotificationDate(notification.fechaEnviada)}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="navbar-notification-empty">No hay notificaciones</div>
                        )}
                      </div>

                      <div className="navbar-notifications-footer">
                        <Link
                          to="/notificaciones"
                          className="navbar-notifications-view-all"
                          onClick={() => setIsNotificationsDropdownOpen(false)}
                        >
                          <EyeIcon className="navbar-notifications-view-all-icon" />
                          Ver todas las notificaciones
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

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
                    <div
                      className="navbar-dropdown-menu navbar-user-dropdown-menu"
                      onMouseEnter={handleUserMouseEnter}
                      onMouseLeave={handleUserMouseLeave}
                    >
                      <Link to="/activos" className="navbar-dropdown-item" onClick={() => setIsUserDropdownOpen(false)}>
                        <WalletIcon className="navbar-dropdown-icon" />
                        Activos
                      </Link>
                      <Link
                        to="/p2p/misOfertas"
                        className="navbar-dropdown-item"
                        onClick={() => setIsUserDropdownOpen(false)}
                      >
                        <BanknotesIcon className="navbar-dropdown-icon" />
                        Mis Ofertas
                      </Link>
                      <Link to="/perfil" className="navbar-dropdown-item" onClick={() => setIsUserDropdownOpen(false)}>
                        <Cog6ToothIcon className="navbar-dropdown-icon" />
                        Configuración
                      </Link>
                      <div className="navbar-dropdown-divider"></div>
                      <div className="navbar-dropdown-logout">
                        <button
                          onClick={() => {
                            logout()
                            setIsUserDropdownOpen(false)
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
              <Link to="/login" className="navbar-login-btn">
                Iniciar Sesión
              </Link>
            )}

            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
