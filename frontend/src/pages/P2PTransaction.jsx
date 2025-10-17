import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMyOfertas, useMyTransacciones } from '../hooks/useP2P';
import MyOfertaItem from '../components/features/MyOfertaItem';
import MyTransaccionItem from '../components/features/MyTransaccionItem';
import '../styles/my-p2p.css';

const MyP2P = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState('ofertas');

  // Hooks de datos
  const {
    ofertas,
    isLoading: loadingOfertas,
    refetch: refetchOfertas,
    toggleOferta,
    isToggling,
  } = useMyOfertas();

  const {
    transacciones,
    isLoading: loadingTransacciones,
    refetch: refetchTransacciones,
    confirmPayment,
    isConfirmingPayment,
    releaseCryptos,
    isReleasingCryptos,
    cancelTransaction,
    isCancelling,
  } = useMyTransacciones();

  /**
   * Navegar a detalles de transacción
   */
  const handleViewTransaction = (transaccionId) => {
    navigate(`/p2p/transaction/${transaccionId}`);
  };

  /**
   * Reintentar carga de datos según tab activa
   */
  const handleRetryLoad = () => {
    if (activeTab === 'ofertas') {
      refetchOfertas();
    } else {
      refetchTransacciones();
    }
  };

  // Determinar loading y datos según tab activa
  const isLoading = activeTab === 'ofertas' ? loadingOfertas : loadingTransacciones;
  const hasError = false; // React Query maneja errores con toast

  /**
   * Renderizar lista de ofertas
   */
  const renderOfertas = () => {
    if (isLoading) {
      return <div className="my-p2p-loading">Cargando ofertas...</div>;
    }

    if (ofertas.length === 0) {
      return (
        <div className="my-p2p-empty">
          No tienes ofertas activas
          <button 
            className="my-p2p-btn my-p2p-btn-primary"
            onClick={refetchOfertas}
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
          <MyOfertaItem
            key={oferta.id}
            oferta={oferta}
            onToggle={toggleOferta}
            isToggling={isToggling}
          />
        ))}
      </div>
    );
  };

  /**
   * Renderizar lista de transacciones
   */
  const renderTransacciones = () => {
    if (isLoading) {
      return <div className="my-p2p-loading">Cargando transacciones...</div>;
    }

    if (transacciones.length === 0) {
      return (
        <div className="my-p2p-empty">
          No tienes transacciones
          <button 
            className="my-p2p-btn my-p2p-btn-primary"
            onClick={refetchTransacciones}
            style={{ marginTop: 'var(--spacing-md)' }}
          >
            Reintentar Carga
          </button>
        </div>
      );
    }

    return (
      <div className="my-p2p-list">
        {transacciones.map((transaccion) => (
          <MyTransaccionItem
            key={transaccion.id}
            transaccion={transaccion}
            userId={user?.id}
            onViewDetails={handleViewTransaction}
            onConfirmPayment={confirmPayment}
            onReleaseCryptos={releaseCryptos}
            onCancel={cancelTransaction}
            isConfirmingPayment={isConfirmingPayment}
            isReleasingCryptos={isReleasingCryptos}
            isCancelling={isCancelling}
          />
        ))}
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