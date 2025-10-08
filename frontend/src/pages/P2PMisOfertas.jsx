import { useState, useEffect } from 'react';
import {
  PencilIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
  LockOpenIcon,
  StarIcon,
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import '../styles/P2PMisOfertas.css';

const P2PMisOfertas = () => {
  const token = localStorage.getItem('token');
  const [tabActivo, setTabActivo] = useState('ofertas');

  // Estado Ofertas
  const [ofertas, setOfertas] = useState([]);
  const [loadingOfertas, setLoadingOfertas] = useState(false);
  const [paginaOfertas, setPaginaOfertas] = useState(1);
  const [hasMoreOfertas, setHasMoreOfertas] = useState(true);

  // Estado Transacciones
  const [transacciones, setTransacciones] = useState([]);
  const [loadingTransacciones, setLoadingTransacciones] = useState(false);
  const [filtroTransacciones, setFiltroTransacciones] = useState('todas');
  const [rolTransacciones, setRolTransacciones] = useState('todas');
  const [paginaTransacciones, setPaginaTransacciones] = useState(1);
  const [hasMoreTransacciones, setHasMoreTransacciones] = useState(true);

  // Modales
  const [modalEditar, setModalEditar] = useState(false);
  const [ofertaEditando, setOfertaEditando] = useState(null);
  const [modalValorar, setModalValorar] = useState(false);
  const [transaccionValorar, setTransaccionValorar] = useState(null);

  // URL fallback para iconos de cripto
  const getCryptoIcon = (crypto) => {
    if (!crypto) return null;
    return crypto.iconUrl || `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${crypto.symbol.toLowerCase()}.svg`;
  };

  // Mensajes
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  useEffect(() => {
    if (tabActivo === 'ofertas') {
      cargarOfertas(1);
    } else {
      cargarTransacciones(1);
    }
  }, [tabActivo]);

  // ========== OFERTAS ========== //
  const cargarOfertas = async (pagina) => {
    setLoadingOfertas(true);
    try {
      const response = await fetch(
        `http://localhost:3001/api/ofertaP2P/me/ofertas?page=${pagina}&limit=10`,
        { headers: { 'Authorization': token } }
      );
      const data = await response.json();

      if (pagina === 1) {
        setOfertas(data.ofertas || data.data || []);
      } else {
        setOfertas(prev => [...prev, ...(data.ofertas || data.data || [])]);
      }

      setHasMoreOfertas((data.ofertas || data.data || []).length === 10);
      setPaginaOfertas(pagina);
    } catch (err) {
      mostrarMensaje('error', 'Error al cargar ofertas');
    } finally {
      setLoadingOfertas(false);
    }
  };

  const abrirModalEditar = (oferta) => {
    setOfertaEditando({
      id: oferta.id,
      precioUnitario: oferta.precioUnitario,
      condicionesAdicionales: oferta.condicionesAdicionales || ''
    });
    setModalEditar(true);
  };

  const guardarEdicion = async () => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/ofertaP2P/${ofertaEditando.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            precioUnitario: parseFloat(ofertaEditando.precioUnitario),
            condicionesAdicionales: ofertaEditando.condicionesAdicionales
          })
        }
      );

      if (!response.ok) throw new Error('Error al actualizar');

      mostrarMensaje('success', 'Oferta actualizada exitosamente');
      setModalEditar(false);
      cargarOfertas(1);
    } catch (err) {
      mostrarMensaje('error', 'Error al actualizar oferta');
    }
  };

  const toggleOferta = async (ofertaId, estadoActual) => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/ofertaP2P/${ofertaId}/toggle`,
        {
          method: 'PATCH',
          headers: { 'Authorization': token }
        }
      );

      if (!response.ok) throw new Error('Error al cambiar estado');

      mostrarMensaje('success', `Oferta ${estadoActual ? 'desactivada' : 'activada'}`);
      cargarOfertas(1);
    } catch (err) {
      mostrarMensaje('error', 'Error al cambiar estado de oferta');
    }
  };

  const eliminarOferta = async (ofertaId) => {
    if (!confirm('¿Estás seguro de eliminar esta oferta?')) return;

    try {
      const response = await fetch(
        `http://localhost:3001/api/ofertaP2P/${ofertaId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': token }
        }
      );

      if (!response.ok) throw new Error('Error al eliminar');

      mostrarMensaje('success', 'Oferta eliminada exitosamente');
      cargarOfertas(1);
    } catch (err) {
      mostrarMensaje('error', 'Error al eliminar oferta');
    }
  };

  // ========== TRANSACCIONES ========== //
  const cargarTransacciones = async (pagina) => {
    setLoadingTransacciones(true);
    try {
      let url = `http://localhost:3001/api/transaccionP2P/me/transacciones?page=${pagina}&limit=10`;
      
      if (filtroTransacciones !== 'todas') {
        url += `&estado=${filtroTransacciones}`;
      }

      const response = await fetch(url, {
        headers: { 'Authorization': token }
      });
      const data = await response.json();

      let transaccionesData = data.transacciones || data.data || [];

      // Filtrar por rol si no es "todas"
      if (rolTransacciones === 'comprador') {
        transaccionesData = transaccionesData.filter(t => t.esComprador);
      } else if (rolTransacciones === 'vendedor') {
        transaccionesData = transaccionesData.filter(t => !t.esComprador);
      }

      if (pagina === 1) {
        setTransacciones(transaccionesData);
      } else {
        setTransacciones(prev => [...prev, ...transaccionesData]);
      }

      setHasMoreTransacciones(transaccionesData.length === 10);
      setPaginaTransacciones(pagina);
    } catch (err) {
      mostrarMensaje('error', 'Error al cargar transacciones');
    } finally {
      setLoadingTransacciones(false);
    }
  };

  const liberarCriptos = async (transaccionId) => {
    if (!confirm('¿Confirmas que recibiste el pago y deseas liberar las criptomonedas?')) return;

    try {
      const response = await fetch(
        `http://localhost:3001/api/transaccionP2P/${transaccionId}/complete`,
        {
          method: 'PATCH',
          headers: { 'Authorization': token }
        }
      );

      if (!response.ok) throw new Error('Error al liberar criptos');

      mostrarMensaje('success', 'Criptomonedas liberadas exitosamente');
      cargarTransacciones(1);
    } catch (err) {
      mostrarMensaje('error', 'Error al liberar criptomonedas');
    }
  };

  const cancelarTransaccion = async (transaccionId) => {
    if (!confirm('¿Estás seguro de cancelar esta transacción?')) return;

    try {
      const response = await fetch(
        `http://localhost:3001/api/transaccionP2P/${transaccionId}/cancel`,
        {
          method: 'PATCH',
          headers: { 'Authorization': token }
        }
      );

      if (!response.ok) throw new Error('Error al cancelar');

      mostrarMensaje('success', 'Transacción cancelada');
      cargarTransacciones(1);
    } catch (err) {
      mostrarMensaje('error', 'Error al cancelar transacción');
    }
  };

  const abrirModalValorar = (transaccion) => {
    setTransaccionValorar({
      id: transaccion.id,
      otroUsuario: transaccion.esComprador ? transaccion.vendedor : transaccion.comprador,
      calificacion: 5,
      comentario: ''
    });
    setModalValorar(true);
  };

  const enviarValoracion = async () => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/transaccionP2P/${transaccionValorar.id}/rate`,
        {
          method: 'POST',
          headers: {
            'Authorization': token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            calificacion: transaccionValorar.calificacion,
            comentario: transaccionValorar.comentario
          })
        }
      );

      if (!response.ok) throw new Error('Error al valorar');

      mostrarMensaje('success', 'Valoración enviada exitosamente');
      setModalValorar(false);
      cargarTransacciones(1);
    } catch (err) {
      mostrarMensaje('error', 'Error al enviar valoración');
    }
  };

  // ========== UTILIDADES ========== //
  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: '', texto: '' }), 5000);
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEstadoBadge = (estado) => {
    const badges = {
      iniciada: { texto: 'Iniciada', clase: 'info' },
      cryptos_bloqueadas: { texto: 'Cryptos Bloqueadas', clase: 'warning' },
      pago_confirmado: { texto: 'Pago Confirmado', clase: 'success' },
      completada: { texto: 'Completada', clase: 'success-dark' },
      cancelada: { texto: 'Cancelada', clase: 'error' }
    };
    return badges[estado] || { texto: estado, clase: 'default' };
  };

  return (
    <div className="p2pMisOfertas-container">
      {/* Header */}
      <header className="p2pMisOfertas-header">
        <h1 className="p2pMisOfertas-titulo">Mis operaciones P2P</h1>
        <button
          className="p2pMisOfertas-btnCrear"
          onClick={() => window.location.href = '/p2p/crearOferta'}
        >
          <PlusIcon className="p2pMisOfertas-btnIcon" />
          Crear nueva oferta
        </button>
      </header>

      {/* Mensajes */}
      {mensaje.texto && (
        <div className={`p2pMisOfertas-mensaje ${mensaje.tipo}`}>
          {mensaje.tipo === 'success' ? (
            <CheckIcon className="p2pMisOfertas-mensajeIcono" />
          ) : (
            <ExclamationTriangleIcon className="p2pMisOfertas-mensajeIcono" />
          )}
          <span>{mensaje.texto}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="p2pMisOfertas-tabs">
        <button
          className={`p2pMisOfertas-tab ${tabActivo === 'ofertas' ? 'active' : ''}`}
          onClick={() => setTabActivo('ofertas')}
        >
          Mis Ofertas
        </button>
        <button
          className={`p2pMisOfertas-tab ${tabActivo === 'transacciones' ? 'active' : ''}`}
          onClick={() => setTabActivo('transacciones')}
        >
          Mis Transacciones
        </button>
      </div>

      {/* Contenido Ofertas */}
      {tabActivo === 'ofertas' && (
        <div className="p2pMisOfertas-contenido">
          <div className="p2pMisOfertas-tableWrapper">
            <table className="p2pMisOfertas-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Cripto</th>
                  <th>Precio</th>
                  <th>Límites</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ofertas.map(oferta => (
                  <tr key={oferta.id}>
                    <td>
                      <span className={`p2pMisOfertas-tipoBadge ${oferta.tipo}`}>
                        {oferta.tipo === 'compra' ? 'Compra' : 'Venta'}
                      </span>
                    </td>
                    <td className="p2pMisOfertas-crypto">
                      <div className="p2pMisOfertas-cryptoCell">
                        {oferta.criptomoneda && (
                          <>
                            <img 
                              src={getCryptoIcon(oferta.criptomoneda)} 
                              alt={oferta.criptomoneda.symbol}
                              className="p2pMisOfertas-cryptoIcon"
                              onError={(e) => {
                                console.error('Error loading icon for', oferta.criptomoneda.symbol);
                                e.target.style.display = 'none';
                              }}
                            />
                            <span>{oferta.criptomoneda.symbol}</span>
                          </>
                        )}
                        {!oferta.criptomoneda && <span>N/A</span>}
                      </div>
                    </td>
                    <td className="p2pMisOfertas-precio">
                      {parseFloat(oferta.precioUnitario).toLocaleString()} {oferta.monedaFiat}
                    </td>
                    <td className="p2pMisOfertas-limites">
                      {parseFloat(oferta.cantidadMin).toFixed(2)} - {parseFloat(oferta.cantidadMax).toFixed(2)} {oferta.monedaFiat}
                    </td>
                    <td>
                      <span className={`p2pMisOfertas-estadoBadge ${oferta.activa ? 'activa' : 'inactiva'}`}>
                        {oferta.activa ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="p2pMisOfertas-fecha">
                      {formatearFecha(oferta.created_at)}
                    </td>
                    <td className="p2pMisOfertas-acciones">
                      <button
                        className="p2pMisOfertas-btnAccion edit"
                        onClick={() => abrirModalEditar(oferta)}
                        title="Editar"
                      >
                        <PencilIcon className="p2pMisOfertas-accionIcon" />
                      </button>
                      <button
                        className="p2pMisOfertas-btnAccion toggle"
                        onClick={() => toggleOferta(oferta.id, oferta.activa)}
                        title={oferta.activa ? 'Desactivar' : 'Activar'}
                      >
                        {oferta.activa ? (
                          <PauseIcon className="p2pMisOfertas-accionIcon" />
                        ) : (
                          <PlayIcon className="p2pMisOfertas-accionIcon" />
                        )}
                      </button>
                      <button
                        className="p2pMisOfertas-btnAccion delete"
                        onClick={() => eliminarOferta(oferta.id)}
                        title="Eliminar"
                      >
                        <TrashIcon className="p2pMisOfertas-accionIcon" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {ofertas.length === 0 && !loadingOfertas && (
              <div className="p2pMisOfertas-empty">
                <p>No tienes ofertas publicadas</p>
                <button
                  className="p2pMisOfertas-btnCrear"
                  onClick={() => window.location.href = '/p2p/crearOferta'}
                >
                  <PlusIcon className="p2pMisOfertas-btnIcon" />
                  Crear primera oferta
                </button>
              </div>
            )}

            {hasMoreOfertas && !loadingOfertas && ofertas.length > 0 && (
              <button
                className="p2pMisOfertas-btnCargarMas"
                onClick={() => cargarOfertas(paginaOfertas + 1)}
              >
                Cargar más
              </button>
            )}

            {loadingOfertas && <div className="p2pMisOfertas-loading">Cargando...</div>}
          </div>
        </div>
      )}

      {/* Contenido Transacciones */}
      {tabActivo === 'transacciones' && (
        <div className="p2pMisOfertas-contenido">
          {/* Filtros */}
          <div className="p2pMisOfertas-filtros">
            <div className="p2pMisOfertas-filtroGrupo">
              <label>Estado:</label>
              <select
                value={filtroTransacciones}
                onChange={(e) => {
                  setFiltroTransacciones(e.target.value);
                  setPaginaTransacciones(1);
                  cargarTransacciones(1);
                }}
                className="p2pMisOfertas-select"
              >
                <option value="todas">Todas</option>
                <option value="iniciada">Iniciada</option>
                <option value="cryptos_bloqueadas">Cryptos Bloqueadas</option>
                <option value="pago_confirmado">Pago Confirmado</option>
                <option value="completada">Completada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>

            <div className="p2pMisOfertas-filtroGrupo">
              <label>Rol:</label>
              <select
                value={rolTransacciones}
                onChange={(e) => {
                  setRolTransacciones(e.target.value);
                  setPaginaTransacciones(1);
                  cargarTransacciones(1);
                }}
                className="p2pMisOfertas-select"
              >
                <option value="todas">Todas</option>
                <option value="comprador">Como Comprador</option>
                <option value="vendedor">Como Vendedor</option>
              </select>
            </div>
          </div>

          <div className="p2pMisOfertas-tableWrapper">
            <table className="p2pMisOfertas-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tipo</th>
                  <th>Cripto</th>
                  <th>Cantidad</th>
                  <th>Total</th>
                  <th>Contraparte</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {transacciones.map(transaccion => {
                  const esVendedor = !transaccion.esComprador;
                  const puedeLiberar = esVendedor && transaccion.estado === 'pago_confirmado';
                  const badge = getEstadoBadge(transaccion.estado);

                  return (
                    <tr key={transaccion.id}>
                      <td className="p2pMisOfertas-idCorto">
                        #{transaccion.id.substring(0, 8)}
                      </td>
                      <td>
                        <span className={`p2pMisOfertas-rolBadge ${esVendedor ? 'vendedor' : 'comprador'}`}>
                          {esVendedor ? 'Vendedor' : 'Comprador'}
                        </span>
                      </td>
                      <td className="p2pMisOfertas-crypto">
                        <div className="p2pMisOfertas-cryptoCell">
                          {transaccion.criptomoneda && (
                            <>
                              <img 
                                src={getCryptoIcon(transaccion.criptomoneda)} 
                                alt={transaccion.criptomoneda.symbol}
                                className="p2pMisOfertas-cryptoIcon"
                                onError={(e) => {
                                  console.error('Error loading icon for', transaccion.criptomoneda.symbol);
                                  e.target.style.display = 'none';
                                }}
                              />
                              <span>{transaccion.criptomoneda.symbol}</span>
                            </>
                          )}
                          {!transaccion.criptomoneda && <span>N/A</span>}
                        </div>
                      </td>
                      <td>
                        {parseFloat(transaccion.cantidad).toFixed(4)}
                      </td>
                      <td className="p2pMisOfertas-total">
                        {parseFloat(transaccion.cantidad * transaccion.precioUnitario).toLocaleString()}
                      </td>
                      <td className="p2pMisOfertas-usuario">
                        {esVendedor
                          ? transaccion.comprador?.username || 'N/A'
                          : transaccion.vendedor?.username || 'N/A'}
                      </td>
                      <td>
                        <span className={`p2pMisOfertas-estadoTransBadge ${badge.clase}`}>
                          {badge.texto}
                        </span>
                      </td>
                      <td className="p2pMisOfertas-fecha">
                        {formatearFecha(transaccion.created_at)}
                      </td>
                      <td className="p2pMisOfertas-acciones">
                        {puedeLiberar && (
                          <button
                            className="p2pMisOfertas-btnLiberar"
                            onClick={() => liberarCriptos(transaccion.id)}
                            title="Liberar criptomonedas"
                          >
                            <LockOpenIcon className="p2pMisOfertas-btnIconSmall" />
                            Liberar
                          </button>
                        )}
                        {transaccion.estado === 'completada' && (
                          <button
                            className="p2pMisOfertas-btnValorar"
                            onClick={() => abrirModalValorar(transaccion)}
                            title="Valorar usuario"
                          >
                            <StarIcon className="p2pMisOfertas-btnIconSmall" />
                            Valorar
                          </button>
                        )}
                        {['iniciada', 'cryptos_bloqueadas'].includes(transaccion.estado) && (
                          <button
                            className="p2pMisOfertas-btnCancelar"
                            onClick={() => cancelarTransaccion(transaccion.id)}
                            title="Cancelar"
                          >
                            <XMarkIcon className="p2pMisOfertas-btnIconSmall" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {transacciones.length === 0 && !loadingTransacciones && (
              <div className="p2pMisOfertas-empty">
                <p>No tienes transacciones</p>
              </div>
            )}

            {hasMoreTransacciones && !loadingTransacciones && transacciones.length > 0 && (
              <button
                className="p2pMisOfertas-btnCargarMas"
                onClick={() => cargarTransacciones(paginaTransacciones + 1)}
              >
                Cargar más
              </button>
            )}

            {loadingTransacciones && <div className="p2pMisOfertas-loading">Cargando...</div>}
          </div>
        </div>
      )}

      {/* Modal Editar Oferta */}
      {modalEditar && (
        <div className="p2pMisOfertas-modal">
          <div className="p2pMisOfertas-modalContenido">
            <div className="p2pMisOfertas-modalHeader">
              <h2>Editar oferta</h2>
              <button
                className="p2pMisOfertas-modalCerrar"
                onClick={() => setModalEditar(false)}
              >
                <XMarkIcon className="p2pMisOfertas-modalCerrarIcon" />
              </button>
            </div>

            <div className="p2pMisOfertas-modalBody">
              <div className="p2pMisOfertas-formGroup">
                <label>Precio unitario</label>
                <input
                  type="number"
                  className="p2pMisOfertas-input"
                  value={ofertaEditando.precioUnitario}
                  onChange={(e) =>
                    setOfertaEditando({ ...ofertaEditando, precioUnitario: e.target.value })
                  }
                  step="0.01"
                />
              </div>

              <div className="p2pMisOfertas-formGroup">
                <label>Condiciones adicionales</label>
                <textarea
                  className="p2pMisOfertas-textarea"
                  value={ofertaEditando.condicionesAdicionales}
                  onChange={(e) =>
                    setOfertaEditando({
                      ...ofertaEditando,
                      condicionesAdicionales: e.target.value
                    })
                  }
                  rows={4}
                  placeholder="Condiciones específicas..."
                />
              </div>
            </div>

            <div className="p2pMisOfertas-modalFooter">
              <button
                className="p2pMisOfertas-btnSecundario"
                onClick={() => setModalEditar(false)}
              >
                Cancelar
              </button>
              <button className="p2pMisOfertas-btnPrimario" onClick={guardarEdicion}>
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Valorar Usuario */}
      {modalValorar && (
        <div className="p2pMisOfertas-modal">
          <div className="p2pMisOfertas-modalContenido">
            <div className="p2pMisOfertas-modalHeader">
              <h2>Valorar usuario</h2>
              <button
                className="p2pMisOfertas-modalCerrar"
                onClick={() => setModalValorar(false)}
              >
                <XMarkIcon className="p2pMisOfertas-modalCerrarIcon" />
              </button>
            </div>

            <div className="p2pMisOfertas-modalBody">
              <p className="p2pMisOfertas-valorarUsuario">
                Usuario: <strong>{transaccionValorar.otroUsuario?.username}</strong>
              </p>

              <div className="p2pMisOfertas-formGroup">
                <label>Calificación</label>
                <div className="p2pMisOfertas-estrellas">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      className={`p2pMisOfertas-estrella ${
                        star <= transaccionValorar.calificacion ? 'activa' : ''
                      }`}
                      onClick={() =>
                        setTransaccionValorar({
                          ...transaccionValorar,
                          calificacion: star
                        })
                      }
                    >
                      <StarIcon className="p2pMisOfertas-estrellaIcon" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="p2pMisOfertas-formGroup">
                <label>Comentario (opcional)</label>
                <textarea
                  className="p2pMisOfertas-textarea"
                  value={transaccionValorar.comentario}
                  onChange={(e) =>
                    setTransaccionValorar({
                      ...transaccionValorar,
                      comentario: e.target.value
                    })
                  }
                  rows={4}
                  placeholder="Comparte tu experiencia..."
                />
              </div>
            </div>

            <div className="p2pMisOfertas-modalFooter">
              <button
                className="p2pMisOfertas-btnSecundario"
                onClick={() => setModalValorar(false)}
              >
                Cancelar
              </button>
              <button className="p2pMisOfertas-btnPrimario" onClick={enviarValoracion}>
                Enviar valoración
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default P2PMisOfertas;