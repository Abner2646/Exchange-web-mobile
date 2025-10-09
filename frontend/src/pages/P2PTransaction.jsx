// src/pages/MyP2P.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/my-p2p.css';

const MyP2P = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState('ofertas');
  const [ofertas, setOfertas] = useState([]);
  const [transacciones, setTransacciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [initialLoad, setInitialLoad] = useState(true);

  const API_URL = 'http://localhost:3001/api';

  // Cargar ofertas del usuario
  const loadOfertas = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/ofertaP2P/me/ofertas`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      setOfertas(data.data || []);
    } catch (err) {
      setError(`Error al cargar ofertas: ${err.message}`);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  };

  // Cargar transacciones del usuario - CORREGIDO PARA CARGA INICIAL
  const loadTransacciones = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      
      console.log('Cargando transacciones...');
      let response = await fetch(`${API_URL}/transaccionP2P/me/transacciones`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Si el endpoint principal falla, intentar con el alternativo
      if (!response.ok) {
        console.log('Endpoint principal falló, intentando con alternativo...');
        response = await fetch(`${API_URL}/transaccionP2P/me/pending`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }

      if (!response.ok) {
        let errorMessage = `Error ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log('Transacciones cargadas:', data);
      
      // Manejar diferentes estructuras de respuesta
      if (Array.isArray(data)) {
        setTransacciones(data);
      } else if (data.transacciones) {
        setTransacciones(data.transacciones);
      } else if (data.data) {
        setTransacciones(data.data);
      } else {
        setTransacciones([]);
      }
    } catch (err) {
      console.error('Error cargando transacciones:', err);
      setError(`Error al cargar transacciones: ${err.message}`);
      setTransacciones([]); // Asegurar que esté vacío en caso de error
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  };

  // Cargar datos según la pestaña activa - CORREGIDO
  useEffect(() => {
    setInitialLoad(true);
    if (activeTab === 'ofertas') {
      loadOfertas();
    } else {
      loadTransacciones();
    }
  }, [activeTab]);

  // Activar/Desactivar oferta
  const handleToggleOferta = async (ofertaId, currentStatus) => {
    try {
      setError('');
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/ofertaP2P/${ofertaId}/toggle`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al cambiar estado de oferta');
      }
      
      // Actualizar estado local
      setOfertas(ofertas.map(oferta => 
        oferta.id === ofertaId 
          ? { ...oferta, activa: !currentStatus }
          : oferta
      ));
    } catch (err) {
      setError(err.message);
    }
  };

  // Confirmar pago (comprador)
  const handleConfirmPayment = async (transaccionId) => {
    try {
      setError('');
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/transaccionP2P/${transaccionId}/confirm-payment`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al confirmar pago');
      }
      
      // Recargar transacciones
      loadTransacciones();
    } catch (err) {
      setError(err.message);
    }
  };

  // Liberar criptomonedas (vendedor)
  const handleReleaseCryptos = async (transaccionId) => {
    try {
      setError('');
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/transaccionP2P/${transaccionId}/complete`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al liberar criptomonedas');
      }
      
      // Recargar transacciones
      loadTransacciones();
    } catch (err) {
      setError(err.message);
    }
  };

  // Cancelar transacción - CORREGIDA LA LÓGICA
  const handleCancelTransaction = async (transaccionId) => {
    try {
      setError('');
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/transaccionP2P/${transaccionId}/cancel`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al cancelar transacción');
      }
      
      // Recargar transacciones
      loadTransacciones();
    } catch (err) {
      setError(err.message);
    }
  };

  // Navegar a detalles de transacción
  const handleViewTransaction = (transaccionId) => {
    navigate(`/p2p/transaction/${transaccionId}`);
  };

  // Botón para reintentar carga
  const handleRetryLoad = () => {
    if (activeTab === 'ofertas') {
      loadOfertas();
    } else {
      loadTransacciones();
    }
  };

  // Función auxiliar para determinar si se puede cancelar una transacción
  const canCancelTransaction = (estado) => {
    return estado === 'iniciada' || estado === 'pago_confirmado';
  };

  // Renderizar lista de ofertas
  const renderOfertas = () => {
    if (loading && initialLoad) {
      return <div className="my-p2p-loading">Cargando ofertas...</div>;
    }

    if (ofertas.length === 0) {
      return (
        <div className="my-p2p-empty">
          {error ? 'Error al cargar ofertas' : 'No tienes ofertas activas'}
          <button 
            className="my-p2p-btn my-p2p-btn-primary"
            onClick={loadOfertas}
            style={{ marginTop: 'var(--spacing-md)' }}
          >
            Reintentar
          </button>
        </div>
      );
    }

    return (
      <div className="my-p2p-list">
        {ofertas.map((oferta) => (
          <div key={oferta.id} className="my-p2p-list-item">
            <div className="my-p2p-item-header">
              <div>
                <div className="my-p2p-item-title">
                  {oferta.tipo === 'venta' ? 'Venta' : 'Compra'} de {oferta.criptomoneda?.symbol}
                </div>
                <div className="my-p2p-item-subtitle">
                  Precio: {oferta.precioUnitario} {oferta.monedaFiat} • Rango: {oferta.cantidadMin} - {oferta.cantidadMax} {oferta.criptomoneda?.symbol}
                </div>
              </div>
              <div className={`my-p2p-item-badge ${
                oferta.activa ? 'my-p2p-badge-active' : 'my-p2p-badge-inactive'
              }`}>
                {oferta.activa ? 'Activa' : 'Inactiva'}
              </div>
            </div>

            <div className="my-p2p-item-details">
              <div className="my-p2p-detail-item">
                <span className="my-p2p-detail-label">Tipo</span>
                <span className="my-p2p-detail-value">
                  {oferta.tipo === 'venta' ? 'Venta' : 'Compra'}
                </span>
              </div>
              <div className="my-p2p-detail-item">
                <span className="my-p2p-detail-label">Precio Unitario</span>
                <span className="my-p2p-detail-value">
                  {oferta.precioUnitario} {oferta.monedaFiat}
                </span>
              </div>
              <div className="my-p2p-detail-item">
                <span className="my-p2p-detail-label">Rango</span>
                <span className="my-p2p-detail-value">
                  {oferta.cantidadMin} - {oferta.cantidadMax} {oferta.criptomoneda?.symbol}
                </span>
              </div>
              <div className="my-p2p-detail-item">
                <span className="my-p2p-detail-label">Métodos de Pago</span>
                <span className="my-p2p-detail-value">
                  {oferta.metodosPago?.length || 0} métodos
                </span>
              </div>
            </div>

            <div className="my-p2p-item-actions">
              <button 
                className={`my-p2p-btn ${
                  oferta.activa ? 'my-p2p-btn-warning' : 'my-p2p-btn-success'
                }`}
                onClick={() => handleToggleOferta(oferta.id, oferta.activa)}
              >
                {oferta.activa ? 'Desactivar' : 'Activar'}
              </button>
              {oferta.condicionesAdicionales && (
                <button className="my-p2p-btn my-p2p-btn-secondary">
                  Ver Condiciones
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Renderizar lista de transacciones - CORREGIDA
  const renderTransacciones = () => {
    if (loading && initialLoad) {
      return <div className="my-p2p-loading">Cargando transacciones...</div>;
    }

    if (transacciones.length === 0) {
      return (
        <div className="my-p2p-empty">
          {error ? 'Error al cargar transacciones' : 'No tienes transacciones'}
          <button 
            className="my-p2p-btn my-p2p-btn-primary"
            onClick={handleRetryLoad}
            style={{ marginTop: 'var(--spacing-md)' }}
          >
            Reintentar Carga
          </button>
        </div>
      );
    }

    return (
      <div className="my-p2p-list">
        {transacciones.map((transaccion) => {
          const isBuyer = transaccion.compradorId === user?.id;
          const isSeller = transaccion.vendedorId === user?.id;
          const userRole = isBuyer ? 'buyer' : 'seller';
          const canCancel = canCancelTransaction(transaccion.estado);

          return (
            <div key={transaccion.id} className="my-p2p-list-item">
              <div className="my-p2p-item-header">
                <div>
                  <div className="my-p2p-item-title">
                    {isBuyer ? 'Compra' : 'Venta'} de {transaccion.cantidad} {transaccion.criptomoneda?.symbol}
                  </div>
                  <div className="my-p2p-item-subtitle">
                    {isBuyer ? 'Vendedor: ' : 'Comprador: '} 
                    {isBuyer ? (transaccion.vendedor?.username || 'Usuario') : (transaccion.comprador?.username || 'Usuario')}
                  </div>
                </div>
                <div className={`my-p2p-item-badge my-p2p-badge-${userRole}`}>
                  {isBuyer ? 'Comprador' : 'Vendedor'}
                </div>
              </div>

              <div className="my-p2p-item-details">
                <div className="my-p2p-detail-item">
                  <span className="my-p2p-detail-label">Estado</span>
                  <span className={`my-p2p-item-badge my-p2p-badge-${transaccion.estado}`}>
                    {transaccion.estado}
                  </span>
                </div>
                <div className="my-p2p-detail-item">
                  <span className="my-p2p-detail-label">Monto Total</span>
                  <span className="my-p2p-detail-value">
                    {transaccion.montoFiat} {transaccion.monedaFiat}
                  </span>
                </div>
                <div className="my-p2p-detail-item">
                  <span className="my-p2p-detail-label">Cantidad</span>
                  <span className="my-p2p-detail-value">
                    {transaccion.cantidad} {transaccion.criptomoneda?.symbol}
                  </span>
                </div>
                <div className="my-p2p-detail-item">
                  <span className="my-p2p-detail-label">Fecha</span>
                  <span className="my-p2p-detail-value">
                    {new Date(transaccion.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="my-p2p-item-actions">
                {/* Botón para ver detalles */}
                <button 
                  className="my-p2p-btn my-p2p-btn-secondary"
                  onClick={() => handleViewTransaction(transaccion.id)}
                >
                  Ver Detalles
                </button>

                {/* Acciones según estado y rol - CORREGIDAS LAS CONDICIONES */}
                {transaccion.estado === 'iniciada' && isBuyer && (
                  <button 
                    className="my-p2p-btn my-p2p-btn-success"
                    onClick={() => handleConfirmPayment(transaccion.id)}
                  >
                    Confirmar Pago
                  </button>
                )}

                {transaccion.estado === 'pago_confirmado' && isSeller && (
                  <button 
                    className="my-p2p-btn my-p2p-btn-primary"
                    onClick={() => handleReleaseCryptos(transaccion.id)}
                  >
                    Liberar Criptomonedas
                  </button>
                )}

                {/* SOLO mostrar cancelar si la transacción puede ser cancelada */}
                {canCancel && (
                  <button 
                    className="my-p2p-btn my-p2p-btn-warning"
                    onClick={() => handleCancelTransaction(transaccion.id)}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="my-p2p-container">
      <header className="my-p2p-header">
        <h1 className="my-p2p-title">Mis Operaciones P2P</h1>
        <p className="my-p2p-subtitle">
          Gestiona tus ofertas y transacciones
        </p>
      </header>

      {error && (
        <div className="my-p2p-error">
          {error}
          <button 
            className="my-p2p-btn my-p2p-btn-primary"
            onClick={handleRetryLoad}
            style={{ marginTop: 'var(--spacing-sm)', marginLeft: 'var(--spacing-md)' }}
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="my-p2p-tabs">
        <button 
          className={`my-p2p-tab ${activeTab === 'ofertas' ? 'my-p2p-tab-active' : ''}`}
          onClick={() => setActiveTab('ofertas')}
        >
          Mis Ofertas ({ofertas.length})
        </button>
        <button 
          className={`my-p2p-tab ${activeTab === 'transacciones' ? 'my-p2p-tab-active' : ''}`}
          onClick={() => setActiveTab('transacciones')}
        >
          Mis Transacciones ({transacciones.length})
        </button>
      </div>

      {activeTab === 'ofertas' ? renderOfertas() : renderTransacciones()}
    </div>
  );
};

export default MyP2P;