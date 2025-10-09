import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/p2p-listing-page.css';

const P2PListingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const token = localStorage.getItem('token');

  const [ofertas, setOfertas] = useState([]);
  const [criptomonedas, setCriptomonedas] = useState([]);
  const [metodosPago, setMetodosPago] = useState([]);
  const [tipoOperacion, setTipoOperacion] = useState('compra');
  const [criptoSeleccionada, setCriptoSeleccionada] = useState('');
  const [busquedaCripto, setBusquedaCripto] = useState('');
  const [loading, setLoading] = useState(true);
  const [usuariosCache, setUsuariosCache] = useState({});

  const API_URL = 'http://localhost:3001/api';

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    cargarDatosIniciales();
  }, []);

  useEffect(() => {
    if (token && criptoSeleccionada) {
      cargarOfertas();
    }
  }, [tipoOperacion, criptoSeleccionada]);

  const cargarDatosIniciales = async () => {
    try {
      // Cargar criptomonedas
      const cryptoResponse = await fetch(`${API_URL}/criptomoneda`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const cryptoData = await cryptoResponse.json();
      
      // Cargar métodos de pago activos
      const metodosResponse = await fetch(`${API_URL}/metodoPago/status/active`);
      const metodosData = await metodosResponse.json();

      if (cryptoResponse.ok) {
        setCriptomonedas(Array.isArray(cryptoData) ? cryptoData : []);
        if (cryptoData.length > 0) {
          setCriptoSeleccionada(cryptoData[0].id);
        }
      }
      if (metodosResponse.ok) {
        setMetodosPago(Array.isArray(metodosData) ? metodosData : []);
      }
    } catch (error) {
      console.error('Error cargando datos iniciales:', error);
    }
  };

  const cargarPerfilUsuario = async (usuarioId) => {
    if (usuariosCache[usuarioId]) {
      return usuariosCache[usuarioId];
    }

    try {
      const response = await fetch(`${API_URL}/usuario/public/${usuarioId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        return null;
      }

      const userData = await response.json();
      
      setUsuariosCache(prev => ({
        ...prev,
        [usuarioId]: userData
      }));

      return userData;
    } catch (err) {
      console.error('Error cargando usuario:', err);
      return null;
    }
  };

  const cargarOfertas = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('activa', 'true');
      
      // ✅ LÓGICA CORREGIDA
      const tipoOferta = tipoOperacion === 'compra' ? 'venta' : 'compra';
      params.append('tipo', tipoOferta);
      
      if (criptoSeleccionada) params.append('criptomonedaId', criptoSeleccionada);

      const response = await fetch(`${API_URL}/ofertaP2P?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Error al cargar ofertas');

      const data = await response.json();
      let ofertasFiltradas = data.data || data;

      if (!Array.isArray(ofertasFiltradas)) {
        ofertasFiltradas = [];
      }

      // ✅ Ordenamiento corregido para la perspectiva del usuario
      ofertasFiltradas.sort((a, b) => {
        return tipoOperacion === 'compra' 
          ? parseFloat(a.precioUnitario) - parseFloat(b.precioUnitario) // Precios más bajos primero para comprar
          : parseFloat(b.precioUnitario) - parseFloat(a.precioUnitario); // Precios más altos primero para vender
      });

      // Cargar perfiles de usuarios
      const usuariosPromises = ofertasFiltradas.map(oferta => 
        cargarPerfilUsuario(oferta.usuarioId)
      );
      
      await Promise.all(usuariosPromises);

      setOfertas(ofertasFiltradas);
    } catch (err) {
      console.error('Error cargando ofertas:', err);
    } finally {
      setLoading(false);
    }
  };

  // Componente para íconos de criptomonedas con fallback
  const CryptoIcon = ({ cripto, size = 32 }) => {
    const [imgError, setImgError] = useState(false);

    if (imgError || !cripto.iconUrl) {
      return (
        <div className="crypto-icon-fallback" style={{ width: size, height: size }}>
          {cripto.symbol.substring(0, 3)}
        </div>
      );
    }

    return (
      <img 
        src={cripto.iconUrl} 
        alt={cripto.symbol}
        className="crypto-icon"
        style={{ width: size, height: size }}
        onError={() => setImgError(true)}
      />
    );
  };

  const iniciarTransaccion = (ofertaId) => {
    // ✅ CORREGIDO: Usar navigate de React Router
    navigate(`/p2p/transaction/${ofertaId}`);
  };

  const crearOferta = () => {
    navigate('/p2p/crearOferta');
  };

  const getUsuarioData = (usuarioId) => {
    if (usuarioId === user?.id) {
      return {
        username: user?.username || 'Tú',
        kycVerificado: user?.kycVerificado || false,
        reputacionPromedio: user?.reputacionPromedio || 0,
        totalValoraciones: user?.totalValoraciones || 0,
        esPropio: true
      };
    }

    const usuario = usuariosCache[usuarioId];
    return {
      username: usuario?.username || `Usuario-${usuarioId?.slice(0, 6) || 'anon'}`,
      kycVerificado: usuario?.kycVerificado || false,
      reputacionPromedio: usuario?.reputacionPromedio || 0,
      totalValoraciones: usuario?.totalValoraciones || 0,
      esPropio: false
    };
  };

  // Filtrar criptomonedas por búsqueda
  const criptosFiltradas = criptomonedas.filter(cripto =>
    cripto.symbol.toLowerCase().includes(busquedaCripto.toLowerCase()) ||
    cripto.nombre.toLowerCase().includes(busquedaCripto.toLowerCase())
  );

  const criptoActual = criptomonedas.find(c => c.id === criptoSeleccionada);

  if (!token) {
    return null;
  }

  if (loading && ofertas.length === 0) {
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

      {/* Barra horizontal de criptomonedas con buscador */}
      <div className="cripto-bar">
        <div className="cripto-search">
          <input
            type="text"
            placeholder="Buscar criptomoneda..."
            value={busquedaCripto}
            onChange={(e) => setBusquedaCripto(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="cripto-list-horizontal">
          {criptosFiltradas.slice(0, 12).map(cripto => (
            <div
              key={cripto.id}
              className={`cripto-item-horizontal ${criptoSeleccionada === cripto.id ? 'active' : ''}`}
              onClick={() => setCriptoSeleccionada(cripto.id)}
            >
              <CryptoIcon cripto={cripto} size={24} />
              <span className="cripto-symbol">{cripto.symbol}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de ofertas */}
      <div className="ofertas-main">
        <div className="ofertas-header">
          <h2>
            {tipoOperacion === 'compra' ? 'Comprar' : 'Vender'} {criptoActual?.symbol}
          </h2>
          <div className="ofertas-controls">
            <span className="ofertas-count">
              {ofertas.length} oferta(s)
            </span>
            <select className="ordenar-select">
              <option>Precio</option>
            </select>
          </div>
        </div>

        <div className="ofertas-list">
          {/* Headers de la tabla */}
          <div className="tabla-header">
            <div className="col-anunciante">Anunciantes</div>
            <div className="col-precio">Precio</div>
            <div className="col-disponible">Disponible/Límite</div>
            <div className="col-pago">Pago</div>
            <div className="col-operacion">Operación</div>
          </div>

          {ofertas.map(oferta => {
            const usuarioData = getUsuarioData(oferta.usuarioId);
            const cripto = criptomonedas.find(c => c.id === oferta.criptomonedaId);

            return (
              <div key={oferta.id} className="oferta-item">
                <div className="col-anunciante">
                  <div className="anunciante-info">
                    <div className="anunciante-avatar">
                      {usuarioData.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="anunciante-detalles">
                      <div className="anunciante-nombre">
                        {usuarioData.username}
                        {usuarioData.kycVerificado && (
                          <span className="verificado-badge">✓</span>
                        )}
                        {usuarioData.esPropio && (
                          <span className="badge-propio">Tú</span>
                        )}
                      </div>
                      <div className="anunciante-stats">
                        <span className="stat-item">{usuarioData.totalValoraciones} órdenes</span>
                        <span className="stat-separator">|</span>
                        <span className="stat-item stat-positivo">
                          {usuarioData.reputacionPromedio 
                            ? `${(usuarioData.reputacionPromedio * 20).toFixed(0)}%` 
                            : '0%'} Completado
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-precio">
                  <div className="precio-valor">
                    {parseFloat(oferta.precioUnitario).toLocaleString('es-AR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </div>
                  <div className="precio-moneda">{oferta.monedaFiat}</div>
                </div>

                <div className="col-disponible">
                  <div className="disponible-cripto">
                    {cripto && <CryptoIcon cripto={cripto} size={16} />}
                    <span>
                      {parseFloat(oferta.cantidadMax).toLocaleString()} {cripto?.symbol}
                    </span>
                  </div>
                  <div className="disponible-rango">
                    {parseFloat(oferta.cantidadMin * oferta.precioUnitario).toLocaleString()} - {parseFloat(oferta.cantidadMax * oferta.precioUnitario).toLocaleString()} {oferta.monedaFiat}
                  </div>
                </div>

                <div className="col-pago">
                  {oferta.metodosPago?.slice(0, 3).map(metodo => (
                    <div key={metodo.id} className="pago-metodo">
                      {metodo.nombre}
                    </div>
                  ))}
                  {oferta.metodosPago?.length > 3 && (
                    <div className="pago-metodo-mas">
                      +{oferta.metodosPago.length - 3}
                    </div>
                  )}
                </div>

                <div className="col-operacion">
                  <button
                    className={`btn-operacion ${tipoOperacion}`}
                    onClick={() => iniciarTransaccion(oferta.id)}
                    disabled={usuarioData.esPropio}
                  >
                    {/* ✅ CORREGIDO: Texto del botón con nombre de criptomoneda */}
                    {tipoOperacion === 'compra' ? 'Comprar' : 'Vender'} {cripto?.symbol}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {ofertas.length === 0 && !loading && (
          <div className="sin-ofertas">
            <p>No se encontraron ofertas para {tipoOperacion === 'compra' ? 'comprar' : 'vender'} {criptoActual?.symbol}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default P2PListingPage;