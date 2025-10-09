"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import {
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline"
import "../styles/Transferencia.css"

const API_URL = "http://localhost:3001/api"

export default function Transferencia() {
  const { user, isAuthenticated } = useAuth()

  // Estados principales
  const [email, setEmail] = useState("")
  const [destinatario, setDestinatario] = useState(null)
  const [searchingUser, setSearchingUser] = useState(false)
  const [userNotFound, setUserNotFound] = useState(false)

  const [criptomonedas, setCriptomonedas] = useState([])
  const [criptoSeleccionada, setCriptoSeleccionada] = useState(null)
  const [searchCrypto, setSearchCrypto] = useState("")
  const [showCryptoDropdown, setShowCryptoDropdown] = useState(false)

  const [cantidad, setCantidad] = useState("")
  const [balances, setBalances] = useState([])
  const [balanceInsuficiente, setBalanceInsuficiente] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Estados del modal de verificación
  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const [verificationCode, setVerificationCode] = useState(["", "", "", "", "", ""])
  const [transferId, setTransferId] = useState(null)
  const [verifying, setVerifying] = useState(false)

  // Estado del historial
  const [historial, setHistorial] = useState([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)

  // Redirigir si no está autenticado
  useEffect(() => {
    if (!isAuthenticated) {
      window.location.href = "/login"
    }
  }, [isAuthenticated])

  // Cargar criptomonedas y balances al montar
  useEffect(() => {
    if (isAuthenticated) {
      cargarCriptomonedas()
      cargarBalances()
      cargarHistorial()
    }
  }, [isAuthenticated])

  // Buscar usuario por email
  useEffect(() => {
    const timer = setTimeout(() => {
      if (email && email.includes("@")) {
        buscarUsuario(email)
      } else {
        setDestinatario(null)
        setUserNotFound(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [email])

  // Verificar balance cuando cambia la cantidad o crypto
  useEffect(() => {
    if (criptoSeleccionada && cantidad && Number.parseFloat(cantidad) > 0) {
      verificarBalance()
    } else {
      setBalanceInsuficiente(false)
    }
  }, [cantidad, criptoSeleccionada])

  const cargarCriptomonedas = async () => {
    try {
      const token = localStorage.getItem("token")
      console.log("[v0] Cargando criptomonedas desde:", `${API_URL}/criptomoneda/public/active`)
      const response = await fetch(`${API_URL}/criptomoneda/public/active`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      console.log("[v0] Respuesta de criptomonedas:", data)
      if (Array.isArray(data)) {
        console.log("[v0] Primera criptomoneda iconUrl:", data[0]?.iconUrl)
        setCriptomonedas(data)
      } else if (data && Array.isArray(data.data)) {
        console.log("[v0] Primera criptomoneda iconUrl:", data.data[0]?.iconUrl)
        setCriptomonedas(data.data)
      } else if (data && Array.isArray(data.criptomonedas)) {
        console.log("[v0] Primera criptomoneda iconUrl:", data.criptomonedas[0]?.iconUrl)
        setCriptomonedas(data.criptomonedas)
      } else {
        console.error("Formato de respuesta inesperado:", data)
        setCriptomonedas([])
      }
    } catch (err) {
      console.error("Error cargando criptomonedas:", err)
      setCriptomonedas([])
    }
  }

  const cargarBalances = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`${API_URL}/balances/my/balances`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      console.log("[v0] Balances recibidos:", data)

      if (Array.isArray(data)) {
        setBalances(data)
      } else if (data && Array.isArray(data.data)) {
        setBalances(data.data)
      } else if (data && Array.isArray(data.balances)) {
        setBalances(data.balances)
      } else {
        console.error("Formato de respuesta inesperado:", data)
        setBalances([])
      }
    } catch (err) {
      console.error("Error cargando balances:", err)
      setBalances([])
    }
  }

  const cargarHistorial = async () => {
    setLoadingHistorial(true)
    try {
      const token = localStorage.getItem("token")
      console.log("[v0] Cargando historial desde:", `${API_URL}/transferencia/my`)
      const response = await fetch(`${API_URL}/transferencia/my`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      console.log("[v0] Respuesta de historial:", data)

      if (Array.isArray(data)) {
        setHistorial(data)
      } else if (data && Array.isArray(data.transferencias)) {
        setHistorial(data.transferencias)
      } else if (data && Array.isArray(data.data)) {
        setHistorial(data.data)
      } else {
        console.error("Formato de respuesta inesperado:", data)
        setHistorial([])
      }
    } catch (err) {
      console.error("Error cargando historial:", err)
      setHistorial([])
    } finally {
      setLoadingHistorial(false)
    }
  }

  const buscarUsuario = async (emailBusqueda) => {
    setSearchingUser(true)
    setUserNotFound(false)
    try {
      const token = localStorage.getItem("token")
      console.log("[v0] Buscando usuario:", `${API_URL}/usuario/search?q=${emailBusqueda}`)
      console.log("[v0] IMPORTANTE: Verifica que la ruta /api/usuario/search esté descomentada en el backend")
      const response = await fetch(`${API_URL}/usuario/search?q=${emailBusqueda}&limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      console.log("[v0] Respuesta de búsqueda de usuario:", data)

      if (data && data.length > 0) {
        const usuario = data[0]
        // No permitir transferir a uno mismo
        if (usuario.id === user.id) {
          setError("No puedes transferir a tu propia cuenta")
          setDestinatario(null)
          setUserNotFound(true)
        } else {
          setDestinatario(usuario)
          setUserNotFound(false)
          setError("")
        }
      } else {
        setDestinatario(null)
        setUserNotFound(true)
      }
    } catch (err) {
      console.error("Error buscando usuario:", err)
      setUserNotFound(true)
    } finally {
      setSearchingUser(false)
    }
  }

  const verificarBalance = async () => {
    try {
      const token = localStorage.getItem("token")
      console.log("[v0] Verificando balance para:", {
        criptomonedaId: criptoSeleccionada.id,
        cantidad: Number.parseFloat(cantidad),
      })
      const response = await fetch(`${API_URL}/transferencia/verify-funds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          criptomonedaId: criptoSeleccionada.id,
          cantidad: Number.parseFloat(cantidad),
        }),
      })
      const data = await response.json()
      console.log("[v0] Respuesta de verificación de fondos:", data)
      setBalanceInsuficiente(!data.tieneFondos)
    } catch (err) {
      console.error("Error verificando fondos:", err)
    }
  }

  const handleEnviarTransferencia = async () => {
    if (!destinatario || !criptoSeleccionada || !cantidad || Number.parseFloat(cantidad) <= 0) {
      setError("Por favor completa todos los campos correctamente")
      return
    }

    if (balanceInsuficiente) {
      setError("Balance insuficiente para realizar la transferencia")
      return
    }

    setLoading(true)
    setError("")

    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`${API_URL}/transferencia`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          usuarioDestinatarioId: destinatario.id,
          criptomonedaId: criptoSeleccionada.id,
          cantidad: Number.parseFloat(cantidad),
          concepto: `Transferencia a ${destinatario.username}`,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setTransferId(data.data.id)
        setShowVerificationModal(true)
      } else {
        setError(data.error || "Error al crear la transferencia")
      }
    } catch (err) {
      console.error("Error enviando transferencia:", err)
      setError("Error de conexión. Intenta nuevamente.")
    } finally {
      setLoading(false)
    }
  }

  const handleVerificarCodigo = async () => {
    const codigo = verificationCode.join("")

    if (codigo.length !== 6) {
      setError("Por favor ingresa el código completo")
      return
    }

    setVerifying(true)
    setError("")

    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`${API_URL}/transferencia/${transferId}/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          codigoVerificacion: codigo,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Transferencia exitosa
        setShowVerificationModal(false)
        setVerificationCode(["", "", "", "", "", ""])
        setEmail("")
        setDestinatario(null)
        setCriptoSeleccionada(null)
        setCantidad("")
        setTransferId(null)

        // Recargar balances e historial
        cargarBalances()
        cargarHistorial()

        alert("¡Transferencia completada exitosamente!")
      } else {
        setError(data.error || "Código incorrecto")
      }
    } catch (err) {
      console.error("Error verificando código:", err)
      setError("Error de conexión. Intenta nuevamente.")
    } finally {
      setVerifying(false)
    }
  }

  const handleReenviarCodigo = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`${API_URL}/transferencia/${transferId}/resend-code`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        alert("Código reenviado a tu email")
      }
    } catch (err) {
      console.error("Error reenviando código:", err)
    }
  }

  const handleCodeInput = (index, value) => {
    if (value.length > 1) return

    const newCode = [...verificationCode]
    newCode[index] = value
    setVerificationCode(newCode)

    // Auto-focus siguiente input
    if (value && index < 5) {
      document.getElementById(`code-${index + 1}`)?.focus()
    }
  }

  const handleCodeKeyDown = (index, e) => {
    if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
      document.getElementById(`code-${index - 1}`)?.focus()
    }
  }

  const getBalanceDisponible = () => {
    if (!criptoSeleccionada) return 0
    const balance = balances.find((b) => b.criptomonedaId === criptoSeleccionada.id)
    console.log("[v0] Balance encontrado para", criptoSeleccionada.symbol, ":", balance)
    return balance ? Number.parseFloat(balance.balanceDisponible) : 0
  }

  const criptosFiltradas = criptomonedas.filter(
    (crypto) =>
      crypto.nombre.toLowerCase().includes(searchCrypto.toLowerCase()) ||
      crypto.symbol.toLowerCase().includes(searchCrypto.toLowerCase()),
  )

  const puedeEnviar =
    destinatario &&
    criptoSeleccionada &&
    cantidad &&
    Number.parseFloat(cantidad) > 0 &&
    !balanceInsuficiente &&
    !loading

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="transferencia-container">
      <div className="transferencia-content">
        <h1 className="transferencia-title">Transferir Criptomonedas</h1>

        {/* Formulario de transferencia */}
        <div className="transferencia-card">
          {/* Campo de email destinatario */}
          <div className="form-group">
            <label className="form-label">
              <MagnifyingGlassIcon className="label-icon" />
              Email del destinatario
            </label>
            <input
              type="email"
              className="form-input"
              placeholder="ejemplo@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {searchingUser && (
              <div className="input-feedback info">
                <ArrowPathIcon className="feedback-icon spinning" />
                Buscando usuario...
              </div>
            )}
            {destinatario && (
              <div className="input-feedback success">
                <CheckCircleIcon className="feedback-icon" />
                Usuario encontrado: <strong>{destinatario.username}</strong>
              </div>
            )}
            {userNotFound && email.includes("@") && (
              <div className="input-feedback error">
                <ExclamationTriangleIcon className="feedback-icon" />
                Usuario no encontrado
              </div>
            )}
          </div>

          {/* Selector de criptomoneda */}
          <div className="form-group">
            <label className="form-label">Criptomoneda</label>
            <div className="crypto-selector">
              <button
                type="button"
                className="crypto-selector-button"
                onClick={() => setShowCryptoDropdown(!showCryptoDropdown)}
              >
                {criptoSeleccionada ? (
                  <div className="crypto-selected">
                    <img
                      src={criptoSeleccionada.iconUrl || "/placeholder.svg"}
                      alt={criptoSeleccionada.symbol}
                      className="crypto-icon"
                      onError={(e) => {
                        e.target.style.display = "none"
                        e.target.nextSibling.style.display = "flex"
                      }}
                    />
                    <div className="crypto-icon-fallback" style={{ display: "none" }}>
                      {criptoSeleccionada.symbol}
                    </div>
                    <div className="crypto-info">
                      <span className="crypto-symbol">{criptoSeleccionada.symbol}</span>
                      <span className="crypto-name">{criptoSeleccionada.nombre}</span>
                    </div>
                  </div>
                ) : (
                  <span className="crypto-placeholder">Seleccionar criptomoneda</span>
                )}
              </button>

              {showCryptoDropdown && (
                <div className="crypto-dropdown">
                  <div className="crypto-search">
                    <MagnifyingGlassIcon className="search-icon" />
                    <input
                      type="text"
                      placeholder="Buscar..."
                      value={searchCrypto}
                      onChange={(e) => setSearchCrypto(e.target.value)}
                      className="crypto-search-input"
                    />
                  </div>
                  <div className="crypto-list">
                    {criptosFiltradas.map((crypto) => (
                      <button
                        key={crypto.id}
                        type="button"
                        className="crypto-item"
                        onClick={() => {
                          setCriptoSeleccionada(crypto)
                          setShowCryptoDropdown(false)
                          setSearchCrypto("")
                        }}
                      >
                        <img
                          src={crypto.iconUrl || "/placeholder.svg"}
                          alt={crypto.symbol}
                          className="crypto-icon"
                          onError={(e) => {
                            e.target.style.display = "none"
                            e.target.nextSibling.style.display = "flex"
                          }}
                        />
                        <div className="crypto-icon-fallback" style={{ display: "none" }}>
                          {crypto.symbol}
                        </div>
                        <div className="crypto-info">
                          <span className="crypto-symbol">{crypto.symbol}</span>
                          <span className="crypto-name">{crypto.nombre}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Campo de cantidad */}
          <div className="form-group">
            <label className="form-label">
              Cantidad
              {criptoSeleccionada && (
                <span className="balance-info">
                  Disponible: {getBalanceDisponible()} {criptoSeleccionada.symbol}
                </span>
              )}
            </label>
            <div className="amount-input-wrapper">
              <input
                type="number"
                className="form-input"
                placeholder="0.00"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                step="0.00000001"
                min="0"
              />
              {criptoSeleccionada && (
                <button
                  type="button"
                  className="max-button"
                  onClick={() => setCantidad(getBalanceDisponible().toString())}
                >
                  MÁX
                </button>
              )}
            </div>
            {balanceInsuficiente && (
              <div className="input-feedback error">
                <ExclamationTriangleIcon className="feedback-icon" />
                Balance insuficiente
              </div>
            )}
          </div>

          {/* Mensaje de error general */}
          {error && (
            <div className="error-message">
              <ExclamationTriangleIcon className="error-icon" />
              {error}
            </div>
          )}

          {/* Botón de enviar */}
          <button className="submit-button" onClick={handleEnviarTransferencia} disabled={!puedeEnviar}>
            <PaperAirplaneIcon className="button-icon" />
            {loading ? "Enviando..." : "Enviar Transferencia"}
          </button>
        </div>

        {/* Historial de transferencias */}
        <div className="historial-section">
          <h2 className="historial-title">Transferencias Enviadas</h2>

          {loadingHistorial ? (
            <div className="loading-historial">
              <ArrowPathIcon className="loading-icon spinning" />
              Cargando historial...
            </div>
          ) : historial.length === 0 ? (
            <div className="empty-historial">
              <ClockIcon className="empty-icon" />
              <p>No hay transferencias enviadas</p>
            </div>
          ) : (
            <div className="historial-table-wrapper">
              <table className="historial-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Destinatario</th>
                    <th>Criptomoneda</th>
                    <th>Cantidad</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((transfer) => (
                    <tr key={transfer.id}>
                      <td>{new Date(transfer.createdAt).toLocaleString("es-AR")}</td>
                      <td>{transfer.destinatario?.username || "N/A"}</td>
                      <td>
                        <div className="crypto-cell">
                          <img
                            src={transfer.criptomonedaTransferencia?.iconUrl || "/placeholder.svg"}
                            alt={transfer.criptomonedaTransferencia?.symbol}
                            className="crypto-icon-small"
                            onError={(e) => {
                              e.target.style.display = "none"
                              e.target.nextSibling.style.display = "flex"
                            }}
                          />
                          <div className="crypto-icon-fallback-small" style={{ display: "none" }}>
                            {transfer.criptomonedaTransferencia?.symbol}
                          </div>
                          {transfer.criptomonedaTransferencia?.symbol}
                        </div>
                      </td>
                      <td>{Number.parseFloat(transfer.cantidad).toFixed(8)}</td>
                      <td>
                        <span className={`status-badge status-${transfer.estado}`}>
                          {transfer.estado === "completada" && "Completada"}
                          {transfer.estado === "pendiente" && "Pendiente"}
                          {transfer.estado === "cancelada" && "Cancelada"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de verificación */}
      {showVerificationModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button
              className="modal-close"
              onClick={() => {
                setShowVerificationModal(false)
                setVerificationCode(["", "", "", "", "", ""])
                setError("")
              }}
            >
              <XMarkIcon className="close-icon" />
            </button>

            <div className="modal-header">
              <h2 className="modal-title">Verificar Transferencia</h2>
              <p className="modal-description">Ingresa el código de 6 dígitos que enviamos a tu email</p>
            </div>

            <div className="verification-code-inputs">
              {verificationCode.map((digit, index) => (
                <input
                  key={index}
                  id={`code-${index}`}
                  type="text"
                  maxLength="1"
                  className="code-input"
                  value={digit}
                  onChange={(e) => handleCodeInput(index, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(index, e)}
                />
              ))}
            </div>

            {error && (
              <div className="modal-error">
                <ExclamationTriangleIcon className="error-icon" />
                {error}
              </div>
            )}

            <button
              className="modal-submit-button"
              onClick={handleVerificarCodigo}
              disabled={verifying || verificationCode.join("").length !== 6}
            >
              {verifying ? "Verificando..." : "Confirmar Transferencia"}
            </button>

            <button className="modal-resend-button" onClick={handleReenviarCodigo}>
              Reenviar código
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
