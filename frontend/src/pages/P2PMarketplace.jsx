import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/P2PMarketplace.css';

const P2PMarketplace = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userDataString = localStorage.getItem('user');
  const userData = userDataString ? JSON.parse(userDataString) : null;
  const currentUserId = userData?.id;

  // Estados
  const [ofertas, setOfertas] = useState([]);
  const [criptomonedas, setCriptomonedas] = useState([]);
  const [metodosPago, setMetodosPago] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ofertaExpandida, setOfertaExpandida] = useState(null);
  const [usuariosCache, setUsuariosCache] = useState({});

  // Estados de filtros
  const [tipoOperacion, setTipoOperacion] = useState('compra');
  const [cryptoSeleccionada, setCryptoSeleccionada] = useState('');
  const [monedaFiat, setMonedaFiat] = useState('ARS');
  const [metodoPagoFiltro, setMetodoPagoFiltro] = useState('');
  const [cantidadBuscar, setCantidadBuscar] = useState('');
  const [ordenarPor, setOrdenarPor] = useState('precio');

  useEffect(() => {
    // Verificar si el usuario está autenticado
    if (!token) {
      navigate('/login');
      return;
    }
    cargarDatosIniciales();
  }, []);

  useEffect(() => {
    if (token && cryptoSeleccionada) {
      cargarOfertas();
    }
  }, [tipoOperacion, cryptoSeleccionada, monedaFiat, metodoPagoFiltro, cantidadBuscar, ordenarPor]);

  const cargarDatosIniciales = async () => {
    try {
      const [resCryptos, resMetodos] = await Promise.all([
        fetch('http://localhost:3001/api/criptomoneda', {
          headers: { 'Authorization': token }
        }),
        fetch('http://localhost:3001/api/metodoPago/status/active')
      ]);

      // Verificar si las respuestas son exitosas
      if (!resCryptos.ok) {
        throw new Error('Error al cargar criptomonedas');
      }
      if (!resMetodos.ok) {
        throw new Error('Error al cargar métodos de pago');
      }

      const cryptos = await resCryptos.json();
      const metodos = await resMetodos.json();

      // ✅ Validar que sean arrays antes de asignar
      setCriptomonedas(Array.isArray(cryptos) ? cryptos : []);
      setMetodosPago(Array.isArray(metodos) ? metodos : []);
      
      // ✅ Solo establecer crypto seleccionada si hay datos
      if (Array.isArray(cryptos) && cryptos.length > 0) {
        setCryptoSeleccionada(cryptos[0].id);
      }
    } catch (err) {
      console.error('Error cargando datos iniciales:', err);
      setError(err.message);
      // Si hay error de autenticación, redirigir al login
      if (err.message.includes('autenticación') || err.message.includes('token')) {
        navigate('/login');
      }
    }
  };

  const cargarPerfilUsuario = async (usuarioId) => {
    if (usuariosCache[usuarioId]) {
      return usuariosCache[usuarioId];
    }

    try {
      const response = await fetch(`http://localhost:3001/api/usuario/public/${usuarioId}`);
      
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
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('activa', 'true');
      params.append('tipo', tipoOperacion);
      
      if (cryptoSeleccionada) params.append('criptomonedaId', cryptoSeleccionada);
      if (monedaFiat) params.append('monedaFiat', monedaFiat);

      const response = await fetch(`http://localhost:3001/api/ofertaP2P?${params}`, {
        headers: { 'Authorization': token }
      });

      if (!response.ok) throw new Error('Error al cargar ofertas');

      const data = await response.json();
      let ofertasFiltradas = data.data || data;

      // ✅ Validar que sea un array
      if (!Array.isArray(ofertasFiltradas)) {
        ofertasFiltradas = [];
      }

      // Filtrar por método de pago
      if (metodoPagoFiltro) {
        ofertasFiltradas = ofertasFiltradas.filter(oferta =>
          oferta.metodosPago?.some(m => m.id === metodoPagoFiltro)
        );
      }

      // Filtrar por cantidad
      if (cantidadBuscar) {
        const cant = parseFloat(cantidadBuscar);
        ofertasFiltradas = ofertasFiltradas.filter(o => 
          parseFloat(o.cantidadMin) <= cant && parseFloat(o.cantidadMax) >= cant
        );
      }

      // Ordenar
      ofertasFiltradas.sort((a, b) => {
        if (ordenarPor === 'precio') {
          return tipoOperacion === 'compra' 
            ? parseFloat(a.precioUnitario) - parseFloat(b.precioUnitario)
            : parseFloat(b.precioUnitario) - parseFloat(a.precioUnitario);
        }
        return 0;
      });

      const usuariosPromises = ofertasFiltradas.map(oferta => 
        cargarPerfilUsuario(oferta.usuarioId)
      );
      
      await Promise.all(usuariosPromises);

      setOfertas(ofertasFiltradas);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpansion = (ofertaId) => {
    setOfertaExpandida(ofertaExpandida === ofertaId ? null : ofertaId);
  };

  const irATransaccion = (ofertaId) => {
    navigate(`/p2p/transaction/${ofertaId}`);
  };

  const getCryptoIcon = (cryptoId) => {
    const crypto = criptomonedas.find(c => c.id === cryptoId);
    return crypto?.iconUrl || null;
  };

  const getCryptoSymbol = (cryptoId) => {
    const crypto = criptomonedas.find(c => c.id === cryptoId);
    return crypto?.symbol || 'N/A';
  };

  const getUsuarioData = (usuarioId) => {
    if (usuarioId === currentUserId) {
      return {
        username: userData?.username || 'Tú',
        kycVerificado: userData?.kycVerificado || false,
        reputacionPromedio: userData?.reputacionPromedio || 0,
        totalValoraciones: userData?.totalValoraciones || 0,
        esPropio: true
      };
    }

    const usuario = usuariosCache[usuarioId];
    return {
      username: usuario?.username || `Usuario-${usuarioId.slice(0, 6)}`,
      kycVerificado: usuario?.kycVerificado || false,
      reputacionPromedio: usuario?.reputacionPromedio || 0,
      totalValoraciones: usuario?.totalValoraciones || 0,
      esPropio: false
    };
  };

  // ✅ Si no hay token, no renderizar nada (el useEffect redirige)
  if (!token) {
    return null;
  }

  return (
    <div className="p2p-marketplace-binance">
      {/* Tabs Comprar/Vender */}
      <div className="tabs-operacion">
        <button 
          className={`tab ${tipoOperacion === 'compra' ? 'active' : ''}`}
          onClick={() => setTipoOperacion('compra')}
        >
          Comprar
        </button>
        <button 
          className={`tab ${tipoOperacion === 'venta' ? 'active' : ''}`}
          onClick={() => setTipoOperacion('venta')}
        >
          Vender
        </button>
        <button 
          className="tab"
          onClick={() => navigate('/p2p/crearOferta')}
        >
          Crear Oferta
        </button>
      </div>

      {/* Pills de criptomonedas con iconos */}
      <div className="crypto-pills">
        {criptomonedas.slice(0, 12).map(crypto => (
          <button
            key={crypto.id}
            className={`crypto-pill ${cryptoSeleccionada === crypto.id ? 'active' : ''}`}
            onClick={() => setCryptoSeleccionada(crypto.id)}
          >
            {crypto.iconUrl && (
              <img 
                src={crypto.iconUrl} 
                alt={crypto.symbol}
                className="crypto-pill-icon"
                onError={(e) => e.target.style.display = 'none'}
              />
            )}
            <span>{crypto.symbol}</span>
          </button>
        ))}
      </div>

      {/* Filtros horizontales */}
      <div className="filtros-horizontal">
        <div className="filtro-grupo">
          <input
            type="number"
            className="filtro-importe"
            placeholder="Importe de la transacción"
            value={cantidadBuscar}
            onChange={(e) => setCantidadBuscar(e.target.value)}
          />
        </div>

        <select 
          className="filtro-moneda"
          value={monedaFiat}
          onChange={(e) => setMonedaFiat(e.target.value)}
        >
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>

        <select
          className="filtro-metodo"
          value={metodoPagoFiltro}
          onChange={(e) => setMetodoPagoFiltro(e.target.value)}
        >
          <option value="">Todos los métodos de pago</option>
          {metodosPago.map(metodo => (
            <option key={metodo.id} value={metodo.id}>
              {metodo.nombre}
            </option>
          ))}
        </select>

        <div className="spacer"></div>

        <div className="ordenar-grupo">
          <span className="ordenar-label">Ordenar por:</span>
          <select 
            className="filtro-orden"
            value={ordenarPor}
            onChange={(e) => setOrdenarPor(e.target.value)}
          >
            <option value="precio">Precio</option>
          </select>
        </div>
      </div>

      {/* Tabla de ofertas */}
      <div className="tabla-ofertas">
        {/* Headers */}
        <div className="tabla-header">
          <div className="col-anunciante">Anunciantes</div>
          <div className="col-precio">Precio</div>
          <div className="col-disponible">Disponible/Límite de órdenes</div>
          <div className="col-pago">Pago</div>
          <div className="col-operacion">Operación</div>
        </div>

        {/* Filas */}
        {loading && (
          <div className="tabla-loading">Cargando ofertas...</div>
        )}

        {!loading && ofertas.length === 0 && (
          <div className="tabla-empty">No hay ofertas disponibles</div>
        )}

        {!loading && ofertas.map(oferta => {
          const cryptoIcon = getCryptoIcon(oferta.criptomonedaId);
          const cryptoSymbol = getCryptoSymbol(oferta.criptomonedaId);
          const usuarioData = getUsuarioData(oferta.usuarioId);

          return (
            <div key={oferta.id} className="tabla-fila-wrapper">
              <div className="tabla-fila">
                {/* Anunciante */}
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

                {/* Precio */}
                <div className="col-precio">
                  <div className="precio-valor">
                    {parseFloat(oferta.precioUnitario).toLocaleString('es-AR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </div>
                  <div className="precio-moneda">{oferta.monedaFiat}</div>
                </div>

                {/* Disponible */}
                <div className="col-disponible">
                  <div className="disponible-cripto">
                    {cryptoIcon && (
                      <img 
                        src={cryptoIcon} 
                        alt={cryptoSymbol}
                        className="cripto-icon-small"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                    <span>
                      {parseFloat(oferta.cantidadMax).toLocaleString()} {cryptoSymbol}
                    </span>
                  </div>
                  <div className="disponible-rango">
                    {parseFloat(oferta.cantidadMin * oferta.precioUnitario).toLocaleString()} - {parseFloat(oferta.cantidadMax * oferta.precioUnitario).toLocaleString()} {oferta.monedaFiat}
                  </div>
                </div>

                {/* Métodos de pago */}
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

                {/* Botón de acción */}
                <div className="col-operacion">
                  <button 
                    className={`btn-operacion ${tipoOperacion}`}
                    onClick={() => irATransaccion(oferta.id)}
                    disabled={usuarioData.esPropio}
                  >
                    {tipoOperacion === 'compra' ? 'Comprar' : 'Vender'} {cryptoSymbol}
                  </button>
                  {oferta.condicionesAdicionales && (
                    <button 
                      className="btn-expandir"
                      onClick={() => toggleExpansion(oferta.id)}
                    >
                      {ofertaExpandida === oferta.id ? 'Ocultar ▲' : 'Ver detalles ▼'}
                    </button>
                  )}
                </div>
              </div>

              {/* Panel expandido */}
              {ofertaExpandida === oferta.id && (
                <div className="panel-expandido">
                  <div className="panel-condiciones">
                    <h4>Condiciones del anunciante</h4>
                    <p>{oferta.condicionesAdicionales}</p>
                  </div>
                  <div className="panel-resumen">
                    <div className="resumen-item">
                      <span>Precio:</span>
                      <strong>{parseFloat(oferta.precioUnitario).toFixed(2)} {oferta.monedaFiat}</strong>
                    </div>
                    <div className="resumen-metodos">
                      <span>Métodos de pago disponibles:</span>
                      {oferta.metodosPago?.map(m => m.nombre).join(', ')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default P2PMarketplace;