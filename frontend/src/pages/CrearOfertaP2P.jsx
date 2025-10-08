import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/CrearOfertaP2P.css';

const CrearOfertaP2P = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // Estado del wizard
  const [pasoActual, setPasoActual] = useState(1);

  // Datos del formulario
  const [criptomonedas, setCriptomonedas] = useState([]);
  const [metodosPago, setMetodosPago] = useState([]);
  const [formData, setFormData] = useState({
    tipo: 'compra',
    criptomonedaId: '',
    monedaFiat: 'ARS',
    precioUnitario: '',
    cantidadMin: '',
    cantidadMax: '',
    metodosPagoIds: [],
    tiempoLimite: 15,
    condicionesAdicionales: '',
    direccionFiat: ''
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  const cargarDatosIniciales = async () => {
    try {
      const [resCryptos, resMetodos] = await Promise.all([
        fetch('http://localhost:3001/api/criptomoneda', {
          headers: { 'Authorization': token }
        }),
        fetch('http://localhost:3001/api/metodoPago/status/active')
      ]);

      const cryptos = await resCryptos.json();
      const metodos = await resMetodos.json();

      setCriptomonedas(cryptos);
      setMetodosPago(metodos);

      if (cryptos.length > 0) {
        setFormData(prev => ({ ...prev, criptomonedaId: cryptos[0].id }));
      }
    } catch (err) {
      console.error('Error cargando datos:', err);
      setErrorMsg('Error al cargar los datos iniciales. Por favor, recarga la página.');
    }
  };

  const handleInputChange = (campo, valor) => {
    setFormData(prev => ({ ...prev, [campo]: valor }));
    setErrorMsg(''); // Limpiar error al cambiar datos
  };

  const toggleMetodoPago = (metodoPagoId) => {
    setFormData(prev => {
      const metodos = prev.metodosPagoIds.includes(metodoPagoId)
        ? prev.metodosPagoIds.filter(id => id !== metodoPagoId)
        : [...prev.metodosPagoIds, metodoPagoId];
      return { ...prev, metodosPagoIds: metodos };
    });
    setErrorMsg('');
  };

  const validarPaso1 = () => {
    if (!formData.criptomonedaId) return 'Por favor, selecciona una criptomoneda';
    if (!formData.precioUnitario || parseFloat(formData.precioUnitario) <= 0) {
      return 'Por favor, ingresa un precio unitario válido';
    }
    return null;
  };

  const validarPaso2 = () => {
    if (!formData.cantidadMin || parseFloat(formData.cantidadMin) <= 0) {
      return 'Por favor, ingresa una cantidad mínima válida';
    }
    if (!formData.cantidadMax || parseFloat(formData.cantidadMax) <= 0) {
      return 'Por favor, ingresa una cantidad máxima válida';
    }
    if (parseFloat(formData.cantidadMin) >= parseFloat(formData.cantidadMax)) {
      return 'La cantidad mínima debe ser menor que la máxima';
    }
    if (formData.metodosPagoIds.length === 0) {
      return 'Por favor, selecciona al menos un método de pago';
    }
    if (formData.tipo === 'venta' && !formData.direccionFiat) {
      return 'La dirección de pago es obligatoria para ofertas de venta (CBU, CVU, Alias, etc.)';
    }
    return null;
  };

  const siguientePaso = () => {
    setErrorMsg('');
    let errorValidacion = null;

    if (pasoActual === 1) errorValidacion = validarPaso1();
    if (pasoActual === 2) errorValidacion = validarPaso2();

    if (errorValidacion) {
      setErrorMsg(errorValidacion);
      return;
    }

    if (pasoActual < 3) {
      setPasoActual(pasoActual + 1);
    } else {
      publicarOferta();
    }
  };

  const anteriorPaso = () => {
    if (pasoActual > 1) {
      setPasoActual(pasoActual - 1);
      setErrorMsg('');
    }
  };

  const publicarOferta = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch('http://localhost:3001/api/ofertaP2P', {
        method: 'POST',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tipo: formData.tipo,
          criptomonedaId: formData.criptomonedaId,
          cantidadMin: parseFloat(formData.cantidadMin),
          cantidadMax: parseFloat(formData.cantidadMax),
          precioUnitario: parseFloat(formData.precioUnitario),
          monedaFiat: formData.monedaFiat,
          direccionFiat: formData.direccionFiat || null,
          condicionesAdicionales: formData.condicionesAdicionales || null,
          metodosPagoIds: formData.metodosPagoIds
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear la oferta');
      }

      setSuccessMsg('¡Oferta publicada exitosamente! Redirigiendo al marketplace...');
      setTimeout(() => {
        navigate('/p2p');
      }, 2000);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getCryptoSymbol = (cryptoId) => {
    const crypto = criptomonedas.find(c => c.id === cryptoId);
    return crypto?.symbol || 'N/A';
  };

  return (
    <div className="crear-oferta-p2p">
      {/* Header */}
      <header className="crear-oferta-header">
        <h1 className="crear-oferta-titulo">Publicar anuncio P2P</h1>
      </header>

      {/* Stepper */}
      <div className="stepper-wizard">
        <div className={`paso ${pasoActual >= 1 ? 'active' : ''}`}>
          <div className="paso-numero">1</div>
          <span className="paso-texto">Establecer tipo y precio</span>
        </div>
        <div className="paso-linea"></div>
        <div className={`paso ${pasoActual >= 2 ? 'active' : ''}`}>
          <div className="paso-numero">2</div>
          <span className="paso-texto">Establecer importe y método de pago</span>
        </div>
        <div className="paso-linea"></div>
        <div className={`paso ${pasoActual >= 3 ? 'active' : ''}`}>
          <div className="paso-numero">3</div>
          <span className="paso-texto">Condiciones y confirmación</span>
        </div>
      </div>

      {/* Mensajes de error/éxito */}
      {errorMsg && (
        <div className="mensaje-error">
          <span className="icono-error">⚠</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mensaje-exito">
          <span className="icono-exito">✓</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Contenido del wizard */}
      <div className="wizard-content">
        {/* Paso 1: Tipo y precio */}
        {pasoActual === 1 && (
          <div className="wizard-paso">
            {/* Tabs Quiero comprar / Quiero vender */}
            <div className="tipo-tabs">
              <button
                className={`tipo-tab ${formData.tipo === 'compra' ? 'active' : ''}`}
                onClick={() => handleInputChange('tipo', 'compra')}
              >
                Quiero comprar
              </button>
              <button
                className={`tipo-tab ${formData.tipo === 'venta' ? 'active' : ''}`}
                onClick={() => handleInputChange('tipo', 'venta')}
              >
                Quiero vender
              </button>
            </div>

            <div className="form-row">
              {/* Activo (Criptomoneda) */}
              <div className="form-group">
                <label className="form-label">Activo</label>
                <select
                  className="form-select"
                  value={formData.criptomonedaId}
                  onChange={(e) => handleInputChange('criptomonedaId', e.target.value)}
                >
                  {criptomonedas.map(crypto => (
                    <option key={crypto.id} value={crypto.id}>
                      {crypto.symbol} - {crypto.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Moneda Fiat */}
              <div className="form-group">
                <label className="form-label">Con fiat</label>
                <select
                  className="form-select"
                  value={formData.monedaFiat}
                  onChange={(e) => handleInputChange('monedaFiat', e.target.value)}
                >
                  <option value="ARS">ARS - Peso argentino</option>
                  <option value="USD">USD - Dólar</option>
                  <option value="EUR">EUR - Euro</option>
                </select>
              </div>
            </div>

            {/* Precio */}
            <div className="form-group">
              <label className="form-label">Precio unitario</label>
              <div className="precio-input-wrapper">
                <input
                  type="number"
                  className="form-input precio-input"
                  placeholder="Ingresa el precio"
                  value={formData.precioUnitario}
                  onChange={(e) => handleInputChange('precioUnitario', e.target.value)}
                  step="0.01"
                />
                <span className="precio-moneda">{formData.monedaFiat}</span>
              </div>
              <p className="form-hint">
                Precio: {formData.precioUnitario ? parseFloat(formData.precioUnitario).toLocaleString() : '0'} {formData.monedaFiat} por {getCryptoSymbol(formData.criptomonedaId)}
              </p>
            </div>
          </div>
        )}

        {/* Paso 2: Importe y método de pago */}
        {pasoActual === 2 && (
          <div className="wizard-paso">
            {/* Título */}
            <h3 className="seccion-titulo">
              Especifica el rango que deseas {formData.tipo === 'compra' ? 'comprar' : 'vender'}
            </h3>

            {/* Límite de orden */}
            <div className="form-group">
              <label className="form-label">Límite de orden</label>
              <div className="limite-inputs">
                <div className="limite-input-group">
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Mínimo"
                    value={formData.cantidadMin}
                    onChange={(e) => handleInputChange('cantidadMin', e.target.value)}
                    step="0.0001"
                  />
                  <span className="input-suffix">{formData.monedaFiat}</span>
                </div>
                <span className="limite-separador">~</span>
                <div className="limite-input-group">
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Máximo"
                    value={formData.cantidadMax}
                    onChange={(e) => handleInputChange('cantidadMax', e.target.value)}
                    step="0.0001"
                  />
                  <span className="input-suffix">{formData.monedaFiat}</span>
                </div>
              </div>
              <div className="limite-hints">
                <span>≈ {formData.cantidadMin && formData.precioUnitario ? (parseFloat(formData.cantidadMin) / parseFloat(formData.precioUnitario)).toFixed(4) : '0'} {getCryptoSymbol(formData.criptomonedaId)}</span>
                <span>≈ {formData.cantidadMax && formData.precioUnitario ? (parseFloat(formData.cantidadMax) / parseFloat(formData.precioUnitario)).toFixed(4) : '0'} {getCryptoSymbol(formData.criptomonedaId)}</span>
              </div>
            </div>

            {/* Dirección de pago (solo para ventas) */}
            {formData.tipo === 'venta' && (
              <div className="form-group">
                <label className="form-label">
                  Dirección de pago <span className="campo-requerido">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: alias.mp, CBU, CVU, email PayPal"
                  value={formData.direccionFiat}
                  onChange={(e) => handleInputChange('direccionFiat', e.target.value)}
                />
                <p className="form-hint">Obligatorio para ofertas de venta. Ingresa tu CBU, CVU, Alias o email de PayPal.</p>
              </div>
            )}

            {/* Método de pago */}
            <div className="form-group">
              <label className="form-label">Método de pago</label>
              <p className="form-hint">Selecciona hasta 5 métodos</p>
              <div className="metodos-grid">
                {metodosPago.map(metodo => (
                  <button
                    key={metodo.id}
                    className={`metodo-pill ${formData.metodosPagoIds.includes(metodo.id) ? 'selected' : ''}`}
                    onClick={() => toggleMetodoPago(metodo.id)}
                    disabled={!formData.metodosPagoIds.includes(metodo.id) && formData.metodosPagoIds.length >= 5}
                  >
                    {formData.metodosPagoIds.includes(metodo.id) && <span className="check-icon">✓</span>}
                    {metodo.nombre}
                  </button>
                ))}
              </div>
            </div>

            {/* Tiempo límite del pago */}
            <div className="form-group">
              <label className="form-label">Tiempo límite del pago</label>
              <select
                className="form-select"
                value={formData.tiempoLimite}
                onChange={(e) => handleInputChange('tiempoLimite', e.target.value)}
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>
            </div>
          </div>
        )}

        {/* Paso 3: Condiciones y confirmación */}
        {pasoActual === 3 && (
          <div className="wizard-paso">
            <div className="form-group">
              <label className="form-label">Condiciones adicionales (opcional)</label>
              <textarea
                className="form-textarea"
                placeholder="Ej: Solo titulares, respuesta en 10 min, etc."
                value={formData.condicionesAdicionales}
                onChange={(e) => handleInputChange('condicionesAdicionales', e.target.value)}
                rows={5}
              />
              <p className="form-hint">Agrega condiciones específicas para tu oferta</p>
            </div>

            {/* Resumen de la oferta */}
            <div className="resumen-oferta">
              <h3 className="resumen-titulo">Resumen de tu oferta</h3>
              <div className="resumen-item">
                <span>Tipo:</span>
                <strong>{formData.tipo === 'compra' ? 'Compra' : 'Venta'}</strong>
              </div>
              <div className="resumen-item">
                <span>Criptomoneda:</span>
                <strong>{getCryptoSymbol(formData.criptomonedaId)}</strong>
              </div>
              <div className="resumen-item">
                <span>Precio:</span>
                <strong>{parseFloat(formData.precioUnitario).toLocaleString()} {formData.monedaFiat}</strong>
              </div>
              <div className="resumen-item">
                <span>Rango:</span>
                <strong>{formData.cantidadMin} - {formData.cantidadMax} {formData.monedaFiat}</strong>
              </div>
              <div className="resumen-item">
                <span>Métodos de pago:</span>
                <strong>{formData.metodosPagoIds.length} seleccionados</strong>
              </div>
              {formData.tipo === 'venta' && formData.direccionFiat && (
                <div className="resumen-item">
                  <span>Dirección de pago:</span>
                  <strong>{formData.direccionFiat}</strong>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Botones de navegación */}
      <div className="wizard-actions">
        {pasoActual > 1 && (
          <button className="btn-anterior" onClick={anteriorPaso} disabled={loading}>
            Anterior
          </button>
        )}
        <button
          className="btn-siguiente"
          onClick={siguientePaso}
          disabled={loading}
        >
          {pasoActual === 3 ? (loading ? 'Publicando...' : 'Publicar oferta') : 'Siguiente'}
        </button>
      </div>
    </div>
  );
};

export default CrearOfertaP2P;