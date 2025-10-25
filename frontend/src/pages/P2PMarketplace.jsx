import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  useCriptomonedas,
  useMetodosPago, 
  useOfertas, 
  useUsuariosCache 
} from '../hooks/useP2P';
import { filtrarCriptomonedas } from '../utils/p2pHelpers';
import CryptoBar from '../components/features/CryptoBar';
import OfertasList from '../components/features/OfertasList';
import '../styles/p2p-listing-page.css';

const P2PMarketplace = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Estados locales
  const [tipoOperacion, setTipoOperacion] = useState('compra');
  const [criptoSeleccionada, setCriptoSeleccionada] = useState('');
  const [busquedaCripto, setBusquedaCripto] = useState('');

  // Hooks de datos
  const { criptomonedas, isLoading: loadingCryptos } = useCriptomonedas();
  const { metodosPago } = useMetodosPago();
  const { ofertas, isLoading: loadingOfertas } = useOfertas(tipoOperacion, criptoSeleccionada);
  const { cargarPerfilesMultiples, getUsuarioData } = useUsuariosCache();

  // Seleccionar primera crypto al cargar
  useEffect(() => {
    if (criptomonedas.length > 0 && !criptoSeleccionada) {
      setCriptoSeleccionada(criptomonedas[0].id);
      console.log('🪙 Primera criptomoneda seleccionada:', criptomonedas[0].symbol);
    }
  }, [criptomonedas, criptoSeleccionada]);

  // Cargar perfiles de usuarios cuando cambien las ofertas
  useEffect(() => {
    if (ofertas.length > 0) {
      const usuarioIds = ofertas.map(o => o.usuarioId);
      cargarPerfilesMultiples(usuarioIds);
      console.log(`👥 Cargando ${usuarioIds.length} perfiles de usuarios`);
    }
  }, [ofertas]);

  /**
   * Navegar a transacción P2P
   */
  const iniciarTransaccion = (ofertaId) => {
    navigate(`/p2p/transaction/${ofertaId}`);
  };

  /**
   * Navegar a crear oferta
   */
  const crearOferta = () => {
    navigate('/p2p/crearOferta');
  };

  /**
   * Obtener datos de usuario con fallback a usuario logueado
   */
  const obtenerDatosUsuario = (usuarioId) => {
    // Si es el usuario logueado
    if (usuarioId === user?.id) {
      return {
        username: user?.username || 'Tú',
        kycVerificado: user?.kycVerificado || false,
        reputacionPromedio: user?.reputacionPromedio || 0,
        totalValoraciones: user?.totalValoraciones || 0,
        esPropio: true,
      };
    }

    // Si es otro usuario
    const usuario = getUsuarioData(usuarioId);
    return {
      username: usuario?.username || `Usuario-${usuarioId?.slice(0, 6) || 'anon'}`,
      kycVerificado: usuario?.kycVerificado || false,
      reputacionPromedio: usuario?.reputacionPromedio || 0,
      totalValoraciones: usuario?.totalValoraciones || 0,
      esPropio: false,
    };
  };

  // Filtrar criptomonedas por búsqueda
  const criptosFiltradas = filtrarCriptomonedas(criptomonedas, busquedaCripto);

  // Crypto actual seleccionada
  const criptoActual = criptomonedas.find(c => c.id === criptoSeleccionada);

  // Loading inicial
  if (loadingCryptos && criptomonedas.length === 0) {
    return (
      <div className="p2p-listing-container">
        <div className="loading-spinner">Cargando ofertas...</div>
      </div>
    );
  }

  return (
    <div className="p2p-listing-container">
      {/* Header con tipo de operación */}
      <div className="p2p-operacion-header">
        <div className="operacion-tabs">
          <button 
            className={`operacion-tab ${tipoOperacion === 'compra' ? 'active' : ''}`}
            onClick={() => setTipoOperacion('compra')}
          >
            Comprar
          </button>
          <button 
            className={`operacion-tab ${tipoOperacion === 'venta' ? 'active' : ''}`}
            onClick={() => setTipoOperacion('venta')}
          >
            Vender
          </button>
        </div>
        <button 
          className="btn-crear-oferta"
          onClick={crearOferta}
        >
          Crear Oferta
        </button>
      </div>

      {/* Barra de criptomonedas */}
      <CryptoBar
        criptomonedas={criptosFiltradas}
        criptoSeleccionada={criptoSeleccionada}
        onCriptoSelect={setCriptoSeleccionada}
        busqueda={busquedaCripto}
        onBusquedaChange={setBusquedaCripto}
        maxVisible={12}
      />

      {/* Lista de ofertas */}
      <OfertasList
        ofertas={ofertas}
        criptomonedas={criptomonedas}
        tipoOperacion={tipoOperacion}
        criptoActual={criptoActual}
        getUsuarioData={obtenerDatosUsuario}
        onIniciarTransaccion={iniciarTransaccion}
        isLoading={loadingOfertas}
      />
    </div>
  );
};

export default P2PMarketplace;