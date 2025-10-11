"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "../context/AuthContext"
import "../styles/SuperAdmin.css"

const SuperAdmin = () => {
  const { user, isAuthenticated } = useAuth()
  const [loading, setLoading] = useState(true)
  const [userInfo, setUserInfo] = useState(null)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const [userEmail, setUserEmail] = useState("")
  const [userLookup, setUserLookup] = useState(null)
  const [criptomonedas, setCriptomonedas] = useState([])
  const [criptoSeleccionada, setCriptoSeleccionada] = useState(null)
  const [searchCrypto, setSearchCrypto] = useState("")
  const [showCryptoDropdown, setShowCryptoDropdown] = useState(false)
  const [amount, setAmount] = useState("")

  // Card 4 states
  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")

  // Loading states for each button
  const [loadingStates, setLoadingStates] = useState({
    card1: false,
    card2: false,
    card3: false,
    card4: false,
  })

  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const [confirmStep, setConfirmStep] = useState(1)

  const dropdownRef = useRef(null)
  const cryptoSearchRef = useRef(null)

  const API_URL = REACT_APP_API_URL

  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const lookupUserByEmail = async (email) => {
    if (!isValidEmail(email)) {
      setUserLookup(null)
      return
    }

    console.log("[v0] Looking up user with email:", email)

    try {
      const token = localStorage.getItem("token")
      console.log("[v0] Token:", token ? "exists" : "missing")

      const response = await fetch(`${API_URL}/usuario/search?q=${email}&limit=1`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      console.log("[v0] User lookup response status:", response.status)

      if (!response.ok) {
        console.log("[v0] User not found or error")
        setUserLookup({ found: false })
        return
      }

      const data = await response.json()
      console.log("[v0] User lookup data:", data)

      if (Array.isArray(data) && data.length > 0) {
        const usuario = data[0]
        setUserLookup({
          found: true,
          username: usuario.username || usuario.nombre || "Usuario encontrado",
          userId: usuario.id,
        })
      } else {
        setUserLookup({ found: false })
      }
    } catch (err) {
      console.error("[v0] Error looking up user:", err)
      setUserLookup({ found: false })
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (userEmail && isValidEmail(userEmail)) {
        lookupUserByEmail(userEmail)
      } else {
        setUserLookup(null)
      }
    }, 500) // Debounce 500ms

    return () => clearTimeout(timer)
  }, [userEmail])

  useEffect(() => {
    if (isAuthenticated) {
      fetchUserInfo()
      cargarCriptomonedas()
    } else {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCryptoDropdown(false)
      }
    }

    if (showCryptoDropdown) {
      document.addEventListener("mousedown", handleClickOutside)
      cryptoSearchRef.current?.focus()
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showCryptoDropdown])

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  const fetchUserInfo = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`${API_URL}/usuario/me`, {
        headers: {
          Authorization: token,
        },
      })

      if (!response.ok) throw new Error("Error al obtener información del usuario")

      const data = await response.json()
      setUserInfo(data)

      if (data.rol !== "super_admin") {
        setError("No tienes permisos para acceder a esta página")
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const cargarCriptomonedas = async () => {
    try {
      const token = localStorage.getItem("token")
      console.log("[v0] Loading cryptocurrencies...")

      const response = await fetch(`${API_URL}/criptomoneda/public/active`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      console.log("[v0] Cryptocurrencies response status:", response.status)

      const data = await response.json()
      console.log("[v0] Cryptocurrencies data:", data)

      let cryptoArray = []
      if (Array.isArray(data)) {
        cryptoArray = data
      } else if (data && Array.isArray(data.data)) {
        cryptoArray = data.data
      } else if (data && Array.isArray(data.criptomonedas)) {
        cryptoArray = data.criptomonedas
      }

      setCriptomonedas(cryptoArray)
      console.log("[v0] Cryptocurrencies loaded:", cryptoArray.length)
    } catch (err) {
      console.error("[v0] Error loading cryptocurrencies:", err)
      setCriptomonedas([])
    }
  }

  const handleApiCall = async (cardNumber, endpoint, method, body = null, clearFormCallback = null) => {
    setLoadingStates((prev) => ({ ...prev, [`card${cardNumber}`]: true }))
    setError(null)
    setSuccessMessage(null)

    try {
      const token = localStorage.getItem("token")
      const options = {
        method,
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
      }

      if (body) {
        options.body = JSON.stringify(body)
      }

      const response = await fetch(`${API_URL}${endpoint}`, options)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Error en la solicitud")
      }

      const data = await response.json()
      setSuccessMessage("Operación completada exitosamente")

      if (clearFormCallback) {
        clearFormCallback()
      }
    } catch (err) {
      setError(`Error: ${err.message}`)
    } finally {
      setLoadingStates((prev) => ({ ...prev, [`card${cardNumber}`]: false }))
    }
  }

  const handleSensitiveAction = (action) => {
    setConfirmAction(action)
    setConfirmStep(1)
    setShowConfirmModal(true)
  }

  const handleConfirmNext = () => {
    if (confirmStep === 1) {
      setConfirmStep(2)
    } else if (confirmStep === 2) {
      setShowConfirmModal(false)
      setConfirmStep(1)
      if (confirmAction === "initializeWallets") {
        handleInitializeWallets()
      } else if (confirmAction === "generatePairs") {
        handleGenerateExchangePairs()
      }
      setConfirmAction(null)
    }
  }

  const handleConfirmCancel = () => {
    setShowConfirmModal(false)
    setConfirmStep(1)
    setConfirmAction(null)
  }

  const handleInitializeWallets = () => {
    handleApiCall(1, "/setupWallets/initialize", "POST", { force: "true" })
  }

  const handleUpdateBalance = () => {
    console.log("[v0] handleUpdateBalance called")
    console.log("[v0] userEmail:", userEmail)
    console.log("[v0] criptoSeleccionada:", criptoSeleccionada)
    console.log("[v0] amount:", amount)
    console.log("[v0] userLookup:", userLookup)

    if (!userEmail || !criptoSeleccionada || !amount) {
      console.log("[v0] Missing required fields")
      setError("Por favor completa todos los campos de Actualizar Balance")
      return
    }

    if (!userLookup || !userLookup.found) {
      console.log("[v0] User not found")
      setError("Usuario no encontrado. Verifica el email.")
      return
    }

    const endpoint = `/balances/user/${userLookup.userId}/crypto/${criptoSeleccionada.id}`
    const body = { amount: Number.parseFloat(amount) }

    console.log("[v0] Making API call to:", endpoint)
    console.log("[v0] With body:", body)

    handleApiCall(2, endpoint, "PUT", body, () => {
      console.log("[v0] Balance updated successfully, clearing form")
      setUserEmail("")
      setUserLookup(null)
      setCriptoSeleccionada(null)
      setAmount("")
    })
  }

  const handleGenerateExchangePairs = () => {
    handleApiCall(3, "/parExchange/generate-all", "POST")
  }

  const handleCreatePaymentMethod = () => {
    if (!nombre || !descripcion) {
      setError("Por favor completa todos los campos de Crear Método de Pago")
      return
    }
    handleApiCall(4, "/metodoPago", "POST", { nombre, descripcion }, () => {
      setNombre("")
      setDescripcion("")
    })
  }

  const criptosFiltradas = criptomonedas.filter(
    (crypto) =>
      crypto.nombre.toLowerCase().includes(searchCrypto.toLowerCase()) ||
      crypto.symbol.toLowerCase().includes(searchCrypto.toLowerCase()),
  )

  if (loading) {
    return (
      <div className="sa-container">
        <div className="sa-loading">Cargando...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="sa-container">
        <div className="sa-error">Debes iniciar sesión para acceder a esta página</div>
      </div>
    )
  }

  if (error && userInfo?.rol !== "super_admin") {
    return (
      <div className="sa-container">
        <div className="sa-error">{error}</div>
      </div>
    )
  }

  return (
    <div className="sa-container">
      <div className="sa-header">
        <h1 className="sa-title">Panel de Super Administrador</h1>
        <div className="sa-user-info">
          <span className="sa-username">{userInfo?.username}</span>
          <span className="sa-role">{userInfo?.rol}</span>
        </div>
      </div>

      {error && <div className="sa-error-banner">{error}</div>}
      {successMessage && <div className="sa-success-banner">{successMessage}</div>}

      <div className="sa-grid">
        <div className="sa-card sa-card-danger">
          <div className="sa-warning-badge">⚠️ Operaciones Sensibles</div>
          <h2 className="sa-card-title">Operaciones Críticas del Sistema</h2>
          <p className="sa-card-description">
            Estas operaciones pueden afectar el funcionamiento del sistema. Requieren confirmación múltiple.
          </p>

          <div className="sa-button-group">
            <button
              className="sa-button sa-button-danger"
              onClick={() => handleSensitiveAction("initializeWallets")}
              disabled={loadingStates.card1}
            >
              {loadingStates.card1 ? "Procesando..." : "Inicializar Wallets"}
            </button>

            <button
              className="sa-button sa-button-danger"
              onClick={() => handleSensitiveAction("generatePairs")}
              disabled={loadingStates.card3}
            >
              {loadingStates.card3 ? "Procesando..." : "Generar Pares"}
            </button>
          </div>
        </div>

        <div className="sa-card">
          <h2 className="sa-card-title">SUMAR Balance</h2>
          <p className="sa-card-description">Actualiza el balance de un usuario para una criptomoneda específica</p>
          <div className="sa-form">
            <div className="sa-input-group">
              <label className="sa-label">Email del Usuario</label>
              <input
                type="email"
                className="sa-input"
                placeholder="usuario@ejemplo.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
              />
              {userLookup && (
                <div className={`sa-user-lookup ${userLookup.found ? "sa-user-found" : "sa-user-not-found"}`}>
                  {userLookup.found ? (
                    <>
                      ✓ Usuario encontrado: <strong>{userLookup.username}</strong>
                    </>
                  ) : (
                    <>✗ Usuario no encontrado</>
                  )}
                </div>
              )}
            </div>

            <div className="sa-input-group">
              <label className="sa-label">Criptomoneda</label>
              <div className="sa-crypto-selector" ref={dropdownRef}>
                <button
                  type="button"
                  className="sa-crypto-selector-button"
                  onClick={() => setShowCryptoDropdown(!showCryptoDropdown)}
                >
                  {criptoSeleccionada ? (
                    <div className="sa-crypto-selected">
                      <img
                        src={criptoSeleccionada.iconUrl || "/placeholder.svg"}
                        alt={criptoSeleccionada.symbol}
                        className="sa-crypto-icon"
                        onError={(e) => {
                          e.target.style.display = "none"
                          e.target.nextSibling.style.display = "flex"
                        }}
                      />
                      <div className="sa-crypto-icon-fallback" style={{ display: "none" }}>
                        {criptoSeleccionada.symbol.slice(0, 3)}
                      </div>
                      <div className="sa-crypto-info">
                        <span className="sa-crypto-symbol">{criptoSeleccionada.symbol}</span>
                        <span className="sa-crypto-name">{criptoSeleccionada.nombre}</span>
                      </div>
                    </div>
                  ) : (
                    <span className="sa-crypto-placeholder">Seleccionar criptomoneda</span>
                  )}
                </button>

                {showCryptoDropdown && (
                  <div className="sa-crypto-dropdown">
                    <div className="sa-crypto-search">
                      <input
                        ref={cryptoSearchRef}
                        type="text"
                        placeholder="Buscar..."
                        value={searchCrypto}
                        onChange={(e) => setSearchCrypto(e.target.value)}
                        className="sa-crypto-search-input"
                      />
                    </div>
                    <div className="sa-crypto-list">
                      {criptosFiltradas.map((crypto) => (
                        <button
                          key={crypto.id}
                          type="button"
                          className="sa-crypto-item"
                          onClick={() => {
                            setCriptoSeleccionada(crypto)
                            setShowCryptoDropdown(false)
                            setSearchCrypto("")
                          }}
                        >
                          <img
                            src={crypto.iconUrl || "/placeholder.svg"}
                            alt={crypto.symbol}
                            className="sa-crypto-icon-small"
                            onError={(e) => {
                              e.target.style.display = "none"
                              e.target.nextSibling.style.display = "flex"
                            }}
                          />
                          <div className="sa-crypto-icon-fallback-small" style={{ display: "none" }}>
                            {crypto.symbol.slice(0, 3)}
                          </div>
                          <span className="sa-crypto-item-symbol">{crypto.symbol}</span>
                          <span className="sa-crypto-item-name">{crypto.nombre}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="sa-input-group">
              <label className="sa-label">Cantidad</label>
              <input
                type="number"
                className="sa-input"
                placeholder="1000.50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.00000001"
              />
            </div>
          </div>
          <button className="sa-button sa-button-primary" onClick={handleUpdateBalance} disabled={loadingStates.card2}>
            {loadingStates.card2 ? "Procesando..." : "AGREGAR Balance"}
          </button>
        </div>

        <div className="sa-card">
          <h2 className="sa-card-title">Crear Método de Pago</h2>
          <p className="sa-card-description">Agrega un nuevo método de pago al sistema</p>
          <div className="sa-form">
            <div className="sa-input-group">
              <label className="sa-label">Nombre</label>
              <input
                type="text"
                className="sa-input"
                placeholder="Transferencia Bancaria"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <div className="sa-input-group">
              <label className="sa-label">Descripción</label>
              <textarea
                className="sa-input sa-textarea"
                placeholder="Método de pago mediante transferencia bancaria..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <button
            className="sa-button sa-button-primary"
            onClick={handleCreatePaymentMethod}
            disabled={loadingStates.card4}
          >
            {loadingStates.card4 ? "Procesando..." : "Crear Método de Pago"}
          </button>
        </div>
      </div>

      {showConfirmModal && (
        <div className="sa-modal-overlay">
          <div className="sa-modal-content">
            <h2 className="sa-modal-title">{confirmStep === 1 ? "¿Está seguro?" : "⚠️ Advertencia Final"}</h2>
            <p className="sa-modal-description">
              {confirmStep === 1
                ? `Está a punto de ejecutar una operación crítica: ${confirmAction === "initializeWallets" ? "Inicializar Wallets" : "Generar Pares de Exchange"}.`
                : "Esto podría ocasionar un error en las referencias a las criptomonedas y afectar el funcionamiento del sistema."}
            </p>
            <div className="sa-modal-buttons">
              <button className="sa-button sa-button-secondary" onClick={handleConfirmCancel}>
                Cancelar
              </button>
              <button className="sa-button sa-button-danger" onClick={handleConfirmNext}>
                {confirmStep === 1 ? "Continuar" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SuperAdmin
