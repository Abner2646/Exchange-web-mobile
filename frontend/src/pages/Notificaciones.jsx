"use client"

import { useState, useEffect } from "react"
import { CheckIcon, FunnelIcon } from "@heroicons/react/24/outline"
import { CheckIcon as CheckIconSolid } from "@heroicons/react/24/solid"
import {
  BellIcon,
  ShieldCheckIcon,
  CogIcon,
  ArrowsRightLeftIcon,
  UsersIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline"
import "../styles/Notificaciones.css"

const Notificaciones = () => {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedType, setSelectedType] = useState("todas")
  const [showFilters, setShowFilters] = useState(false)
  const itemsPerPage = 10

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://localhost:3001"

  console.log("[v0] API_BASE_URL:", API_BASE_URL)
  console.log("[v0] NEXT_PUBLIC_API_URL env var:", process.env.NEXT_PUBLIC_API_URL)

  const getToken = () => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token")
    console.log("[v0] Token retrieved:", token ? `${token.substring(0, 20)}...` : "NO TOKEN FOUND")
    return token
  }

  const notificationTypes = [
    { value: "todas", label: "Todas" },
    { value: "deposito", label: "Depósitos" },
    { value: "seguridad", label: "Seguridad" },
    { value: "sistema", label: "Sistema" },
    { value: "transaccion", label: "Transacciones" },
    { value: "p2p", label: "P2P" },
    { value: "swap", label: "Swap" },
  ]

  const getNotificationIcon = (tipo) => {
    const iconProps = { className: "notif-icon" }
    switch (tipo) {
      case "deposito":
        return <BellIcon {...iconProps} />
      case "seguridad":
        return <ShieldCheckIcon {...iconProps} />
      case "sistema":
        return <CogIcon {...iconProps} />
      case "transaccion":
        return <ArrowsRightLeftIcon {...iconProps} />
      case "p2p":
        return <UsersIcon {...iconProps} />
      case "swap":
        return <ArrowPathIcon {...iconProps} />
      default:
        return <BellIcon {...iconProps} />
    }
  }

  const fetchNotifications = async () => {
    console.log("[v0] fetchNotifications called")
    setLoading(true)
    try {
      const token = getToken()
      const url = `${API_BASE_URL}/api/notificaciones/me`
      console.log("[v0] Fetching notifications from:", url)
      console.log("[v0] Using token:", token ? "YES" : "NO")

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      console.log("[v0] Response status:", response.status)
      console.log("[v0] Response ok:", response.ok)

      if (response.ok) {
        const data = await response.json()
        console.log("[v0] Raw data received:", data)
        console.log("[v0] Data type:", typeof data)
        console.log("[v0] Is array?:", Array.isArray(data))

        let notificationsArray = data

        // If data is an object with a notificaciones property
        if (data && typeof data === "object" && !Array.isArray(data)) {
          console.log("[v0] Data is object, checking for notificaciones property")
          notificationsArray = data.notificaciones || data.data || []
        }

        console.log("[v0] Notifications array:", notificationsArray)
        console.log("[v0] Notifications count:", notificationsArray.length)
        console.log("[v0] First notification:", notificationsArray[0])

        // Ordenar por fecha descendente (más recientes primero)
        const sortedData = notificationsArray.sort((a, b) => new Date(b.fechaEnviada) - new Date(a.fechaEnviada))
        setNotifications(sortedData)
      } else {
        console.log("[v0] Response not ok, status:", response.status)
      }
    } catch (error) {
      console.error("[v0] Error fetching notifications:", error)
      console.error("[v0] Error details:", error.message)
    } finally {
      setLoading(false)
      console.log("[v0] Loading finished")
    }
  }

  const fetchUnreadCount = async () => {
    console.log("[v0] fetchUnreadCount called")
    try {
      const token = getToken()
      const url = `${API_BASE_URL}/api/notificaciones/me/unread-count`
      console.log("[v0] Fetching unread count from:", url)

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      console.log("[v0] Unread count response status:", response.status)

      if (response.ok) {
        const data = await response.json()
        console.log("[v0] Unread count data:", data)
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (error) {
      console.error("[v0] Error fetching unread count:", error)
    }
  }

  const markAllAsRead = async () => {
    console.log("[v0] markAllAsRead called")
    try {
      const token = getToken()
      const url = `${API_BASE_URL}/api/notificaciones/me/mark-all-read`
      console.log("[v0] Marking all as read:", url)

      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      console.log("[v0] Mark all as read response:", response.status)

      if (response.ok) {
        fetchNotifications()
        fetchUnreadCount()
      }
    } catch (error) {
      console.error("[v0] Error marking all as read:", error)
    }
  }

  const toggleNotificationRead = async (notification) => {
    console.log("[v0] toggleNotificationRead called for notification:", notification.id)
    try {
      const token = getToken()
      const endpoint = notification.leida ? "mark-unread" : "mark-read"
      const url = `${API_BASE_URL}/api/notificaciones/me/${notification.id}/${endpoint}`
      console.log("[v0] Toggle read status URL:", url)

      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      console.log("[v0] Toggle read response:", response.status)

      if (response.ok) {
        fetchNotifications()
        fetchUnreadCount()
      }
    } catch (error) {
      console.error("[v0] Error toggling notification read status:", error)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now - date
    const diffInMinutes = Math.floor(diffInMs / 60000)
    const diffInHours = Math.floor(diffInMs / 3600000)
    const diffInDays = Math.floor(diffInMs / 86400000)

    if (diffInMinutes < 1) return "Ahora"
    if (diffInMinutes < 60) return `Hace ${diffInMinutes}m`
    if (diffInHours < 24) return `Hace ${diffInHours}h`
    if (diffInDays < 7) return `Hace ${diffInDays}d`

    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
    })
  }

  useEffect(() => {
    console.log("[v0] Component mounted, fetching data...")
    fetchNotifications()
    fetchUnreadCount()
  }, [])

  // Filtrar notificaciones por tipo
  const filteredNotifications =
    selectedType === "todas" ? notifications : notifications.filter((n) => n.tipo === selectedType)

  console.log("[v0] Filtered notifications count:", filteredNotifications.length)
  console.log("[v0] Current page:", currentPage)
  console.log("[v0] Loading state:", loading)

  // Paginación
  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentNotifications = filteredNotifications.slice(startIndex, endIndex)

  // Resetear página al cambiar filtro
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedType])

  return (
    <div className="notif-container">
      {/* Header */}
      <div className="notif-header">
        <div className="notif-header-left">
          <h1 className="notif-title">Notificaciones</h1>
          {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
        </div>

        <div className="notif-header-actions">
          <button className="notif-filter-btn" onClick={() => setShowFilters(!showFilters)}>
            <FunnelIcon className="notif-btn-icon" />
            Filtrar
          </button>

          <button className="notif-mark-all-btn" onClick={markAllAsRead} disabled={unreadCount === 0}>
            <CheckIcon className="notif-btn-icon" />
            Marcar todas como leídas
          </button>
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="notif-filters">
          {notificationTypes.map((type) => (
            <button
              key={type.value}
              className={`notif-filter-chip ${selectedType === type.value ? "active" : ""}`}
              onClick={() => setSelectedType(type.value)}
            >
              {type.label}
            </button>
          ))}
        </div>
      )}

      {/* Lista de notificaciones */}
      <div className="notif-list">
        {loading ? (
          // Skeleton loaders
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="notif-item skeleton">
              <div className="notif-item-icon skeleton-icon"></div>
              <div className="notif-item-content">
                <div className="skeleton-title"></div>
                <div className="skeleton-message"></div>
              </div>
              <div className="skeleton-time"></div>
            </div>
          ))
        ) : currentNotifications.length === 0 ? (
          // Empty state
          <div className="notif-empty">
            <BellIcon className="notif-empty-icon" />
            <p className="notif-empty-text">No hay notificaciones</p>
            <p className="notif-empty-subtext">
              {selectedType !== "todas" ? "Intenta cambiar el filtro" : "Cuando recibas notificaciones aparecerán aquí"}
            </p>
          </div>
        ) : (
          currentNotifications.map((notification) => (
            <div key={notification.id} className={`notif-item ${!notification.leida ? "unread" : ""}`}>
              {!notification.leida && <div className="notif-unread-indicator"></div>}

              <div className="notif-item-icon-wrapper">{getNotificationIcon(notification.tipo)}</div>

              <div className="notif-item-content">
                <h3 className="notif-item-title">{notification.titulo}</h3>
                <p className="notif-item-message">{notification.mensaje}</p>
              </div>

              <div className="notif-item-right">
                <span className="notif-item-time">{formatDate(notification.fechaEnviada)}</span>

                <button
                  className={`notif-toggle-btn ${notification.leida ? "read" : "unread"}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleNotificationRead(notification)
                  }}
                  title={notification.leida ? "Marcar como no leída" : "Marcar como leída"}
                >
                  {notification.leida ? (
                    <CheckIconSolid className="notif-toggle-icon" />
                  ) : (
                    <CheckIcon className="notif-toggle-icon" />
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Paginación */}
      {!loading && filteredNotifications.length > itemsPerPage && (
        <div className="notif-pagination">
          <button
            className="notif-pagination-btn"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Anterior
          </button>

          <span className="notif-pagination-info">
            Página {currentPage} de {totalPages}
          </span>

          <button
            className="notif-pagination-btn"
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}

export default Notificaciones
