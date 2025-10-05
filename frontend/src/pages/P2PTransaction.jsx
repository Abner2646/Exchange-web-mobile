import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/P2PTransaction.css';

const P2PTransaction = () => {
  const { id: ofertaId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userDataString = localStorage.getItem('user');
  const userData = userDataString ? JSON.parse(userDataString) : null;
  const currentUserId = userData?.id;

  // Estados
  const [oferta, setOferta] = useState(null);
  const [transaccion, setTransaccion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cantidad, setCantidad] = useState('');
  const [metodoPagoSeleccionado, setMetodoPagoSeleccionado] = useState('');

  useEffect(() => {
    cargarOferta();
  }, [ofertaId]);

  const cargarOferta = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/ofertaP2P/${ofertaId}`, {
        headers: { 'Authorization': token }
      });

      if (!response.ok) throw new Error('Oferta no encontrada');

      const data = await response.json();
      setOferta(data);

      // Pre-seleccionar primer método de pago
      if (data.metodosPago && data.metodosPago.length > 0) {
        setMetodoPagoSeleccionado(data.metodosPago[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const calcularMontoFiat = () => {
    if (!cantidad || !oferta) return '0.00';
    return (parseFloat(cantidad) * parseFloat(oferta.precioUnitario)).toFixed(2);
  };

  const validarCantidad = () => {
    if (!cantidad) return 'Ingresa una cantidad';
    const cant = parseFloat(cantidad);
    if (cant < parseFloat(oferta.cantidadMin)) {
      return `Mínimo: ${oferta.cantidadMin}`;
    }
    if (cant > parseFloat(oferta.cantidadMax)) {
      return `Máximo: ${oferta.cantidadMax}`;
    }
    return null;
  };

const iniciarTransaccion = async () => {
  const errorCantidad = validarCantidad();
  if (errorCantidad) {
    alert(errorCantidad);
    return;
  }

  if (!metodoPagoSeleccionado) {
    alert('Selecciona un método de pago');
    return;
  }

  try {
    const response = await fetch('http://localhost:3001/api/transaccionP2P', {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ofertaId: oferta.id,
        cantidad: parseFloat(cantidad),
        metodoPagoId: metodoPagoSeleccionado
      })
    });

    // ✅ MEJORADO: Leer el error del backend
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error desconocido al crear transacción');
    }

    const data = await response.json();
    setTransaccion(data.data);
  } catch (err) {
    // ✅ MEJORADO: Mostrar el error real
    console.error('Error completo:', err);
    alert(`Error: ${err.message}`);
  }
};

  const ejecutarAccion = async (accion) => {
    if (!transaccion) return;

    const endpoints = {
      'bloquear': `/api/transaccionP2P/${transaccion.id}/lock-cryptos`,
      'pagar': `/api/transaccionP2P/${transaccion.id}/confirm-payment`,
      'completar': `/api/transaccionP2P/${transaccion.id}/complete`,
      'cancelar': `/api/transaccionP2P/${transaccion.id}/cancel`
    };

    try {
      const response = await fetch(`http://localhost:3001${endpoints[accion]}`, {
        method: 'PATCH',
        headers: { 'Authorization': token }
      });

      if (!response.ok) throw new Error('Error al ejecutar acción');

      const data = await response.json();
      setTransaccion(data.data);
      
      if (data.data.estado === 'completada' || data.data.estado === 'cancelada') {
        setTimeout(() => navigate('/p2p'), 2000);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const esVendedor = transaccion?.vendedorId === currentUserId;
  const esComprador = transaccion?.compradorId === currentUserId;

  if (loading) {
    return <div className="transaction-loading">Cargando...</div>;
  }

  if (error || !oferta) {
    return (
      <div className="transaction-error">
        <p>{error || 'Oferta no encontrada'}</p>
        <button onClick={() => navigate('/p2p')} className="btn-volver">
          Volver al marketplace
        </button>
      </div>
    );
  }

  return (
    <div className="p2p-transaction">
      {/* Header */}
      <header className="transaction-header">
        <button onClick={() => navigate('/p2p')} className="btn-back">
          ← Volver
        </button>
        <h1 className="transaction-title">
          {transaccion ? 'Transacción en proceso' : 'Detalle de oferta'}
        </h1>
      </header>

      <div className="transaction-layout">
        {/* Panel izquierdo - Información */}
        <div className="transaction-info-panel">
          {/* Información de la oferta */}
          <div className="info-card">
            <h2 className="info-card-title">Información de la oferta</h2>
            
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Tipo:</span>
                <span className={`info-badge ${oferta.tipo}`}>
                  {oferta.tipo === 'compra' ? 'Compra' : 'Venta'}
                </span>
              </div>

              <div className="info-item">
                <span className="info-label">Criptomoneda:</span>
                <span className="info-value">{oferta.criptomoneda?.symbol}</span>
              </div>

              <div className="info-item">
                <span className="info-label">Precio unitario:</span>
                <span className="info-value">
                  {parseFloat(oferta.precioUnitario).toFixed(2)} {oferta.monedaFiat}
                </span>
              </div>

              <div className="info-item">
                <span className="info-label">Rango:</span>
                <span className="info-value">
                  {parseFloat(oferta.cantidadMin).toFixed(4)} - {parseFloat(oferta.cantidadMax).toFixed(4)}
                </span>
              </div>
            </div>

            {oferta.condicionesAdicionales && (
              <div className="condiciones-box">
                <p className="info-label">Condiciones:</p>
                <p className="condiciones-text">{oferta.condicionesAdicionales}</p>
              </div>
            )}
          </div>

          {/* Métodos de pago */}
          <div className="info-card">
            <h3 className="info-card-title">Métodos de pago aceptados</h3>
            <div className="metodos-list">
              {oferta.metodosPago?.map(metodo => (
                <div key={metodo.id} className="metodo-item">
                  <span className="metodo-nombre">{metodo.nombre}</span>
                  {metodo.descripcion && (
                    <span className="metodo-desc">{metodo.descripcion}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Información de pago (solo si hay transacción y es venta) */}
          {transaccion && oferta.tipo === 'venta' && oferta.direccionFiat && (
            <div className="info-card pago-info">
              <h3 className="info-card-title">Información de pago</h3>
              <div className="direccion-pago">
                <p className="info-label">Enviar pago a:</p>
                <p className="direccion-valor">{oferta.direccionFiat}</p>
              </div>
            </div>
          )}
        </div>

        {/* Panel derecho - Acción */}
        <div className="transaction-action-panel">
          {!transaccion ? (
            /* Formulario para iniciar transacción */
            <div className="action-card">
              <h2 className="action-card-title">Aceptar oferta</h2>

              <div className="form-group">
                <label className="form-label">Cantidad</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder={`Min: ${oferta.cantidadMin} - Max: ${oferta.cantidadMax}`}
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  step="0.0001"
                />
                {validarCantidad() && (
                  <span className="form-error">{validarCantidad()}</span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Método de pago</label>
                <select
                  className="form-select"
                  value={metodoPagoSeleccionado}
                  onChange={(e) => setMetodoPagoSeleccionado(e.target.value)}
                >
                  {oferta.metodosPago?.map(metodo => (
                    <option key={metodo.id} value={metodo.id}>
                      {metodo.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="resumen-box">
                <div className="resumen-item">
                  <span>Total a pagar:</span>
                  <span className="resumen-valor">
                    {calcularMontoFiat()} {oferta.monedaFiat}
                  </span>
                </div>
              </div>

              <button
                className="btn-confirmar"
                onClick={iniciarTransaccion}
                disabled={!!validarCantidad()}
              >
                Confirmar transacción
              </button>
            </div>
          ) : (
            /* Estado de transacción */
            <div className="action-card">
              <h2 className="action-card-title">Estado de transacción</h2>

              {/* Stepper de estados */}
              <div className="stepper">
                <div className={`step ${transaccion.estado === 'iniciada' ? 'active' : 'completed'}`}>
                  <div className="step-circle">1</div>
                  <p className="step-label">Iniciada</p>
                </div>

                <div className={`step ${transaccion.estado === 'cryptos_bloqueadas' ? 'active' : transaccion.estado === 'pago_confirmado' || transaccion.estado === 'completada' ? 'completed' : ''}`}>
                  <div className="step-circle">2</div>
                  <p className="step-label">Cryptos bloqueadas</p>
                </div>

                <div className={`step ${transaccion.estado === 'pago_confirmado' ? 'active' : transaccion.estado === 'completada' ? 'completed' : ''}`}>
                  <div className="step-circle">3</div>
                  <p className="step-label">Pago confirmado</p>
                </div>

                <div className={`step ${transaccion.estado === 'completada' ? 'active' : ''}`}>
                  <div className="step-circle">4</div>
                  <p className="step-label">Completada</p>
                </div>
              </div>

              {/* Información de la transacción */}
              <div className="transaction-details">
                <div className="detail-item">
                  <span className="detail-label">Cantidad:</span>
                  <span className="detail-value">
                    {parseFloat(transaccion.cantidad).toFixed(4)} {oferta.criptomoneda?.symbol}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Monto total:</span>
                  <span className="detail-value">
                    {parseFloat(transaccion.montoFiat).toFixed(2)} {transaccion.monedaFiat}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Tu rol:</span>
                  <span className="detail-value">
                    {esVendedor ? 'Vendedor' : 'Comprador'}
                  </span>
                </div>
              </div>

              {/* Botones de acción según estado y rol */}
              <div className="action-buttons">
                {transaccion.estado === 'iniciada' && esVendedor && (
                  <button className="btn-action primary" onClick={() => ejecutarAccion('bloquear')}>
                    Bloquear criptomonedas
                  </button>
                )}

                {transaccion.estado === 'cryptos_bloqueadas' && esComprador && (
                  <button className="btn-action primary" onClick={() => ejecutarAccion('pagar')}>
                    Confirmar pago realizado
                  </button>
                )}

                {transaccion.estado === 'pago_confirmado' && esVendedor && (
                  <button className="btn-action primary" onClick={() => ejecutarAccion('completar')}>
                    Completar transacción
                  </button>
                )}

                {transaccion.estado !== 'completada' && transaccion.estado !== 'cancelada' && (
                  <button className="btn-action danger" onClick={() => ejecutarAccion('cancelar')}>
                    Cancelar transacción
                  </button>
                )}

                {transaccion.estado === 'completada' && (
                  <div className="success-message">
                    ✓ Transacción completada exitosamente
                  </div>
                )}

                {transaccion.estado === 'cancelada' && (
                  <div className="error-message">
                    ✗ Transacción cancelada
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default P2PTransaction;