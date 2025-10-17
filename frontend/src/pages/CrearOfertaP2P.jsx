import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useCriptomonedas, useMetodosPago, useCreateOferta } from '../hooks/useP2P';
import { validateP2PPaso1, validateP2PPaso2 } from '../utils/validators';
import StepperWizard from '../components/features/p2p/StepperWizard';
import Paso1TipoPrecio from '../components/features/p2p/Paso1TipoPrecio';
import Paso2ImportePago from '../components/features/p2p/Paso2ImportePago';
import Paso3Confirmacion from '../components/features/p2p/Paso3Confirmacion';
import '../styles/CrearOfertaP2P.css';

const CrearOfertaP2P = () => {
  const navigate = useNavigate();

  // Estado del wizard
  const [pasoActual, setPasoActual] = useState(1);
  const [errorMsg, setErrorMsg] = useState('');

  // Datos del formulario
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

  // Hooks de datos
  const { criptomonedas, isLoading: loadingCryptos } = useCriptomonedas();
  const { metodosPago, isLoading: loadingMetodos } = useMetodosPago();
  const { createOfertaAsync, isCreating } = useCreateOferta();

  // Seleccionar primera crypto al cargar
  useEffect(() => {
    if (criptomonedas.length > 0 && !formData.criptomonedaId) {
      setFormData(prev => ({ 
        ...prev, 
        criptomonedaId: criptomonedas[0].id 
      }));
      console.log('🪙 Primera criptomoneda seleccionada:', criptomonedas[0].symbol);
    }
  }, [criptomonedas, formData.criptomonedaId]);

  /**
   * Manejar cambio de inputs
   */
  const handleInputChange = (campo, valor) => {
    setFormData(prev => ({ ...prev, [campo]: valor }));
    setErrorMsg('');
  };

  /**
   * Toggle de método de pago
   */
  const toggleMetodoPago = (metodoPagoId) => {
    setFormData(prev => {
      const metodos = prev.metodosPagoIds.includes(metodoPagoId)
        ? prev.metodosPagoIds.filter(id => id !== metodoPagoId)
        : [...prev.metodosPagoIds, metodoPagoId];
      return { ...prev, metodosPagoIds: metodos };
    });
    setErrorMsg('');
  };

  /**
   * Validar paso actual
   */
  const validarPasoActual = () => {
    let errorValidacion = null;

    if (pasoActual === 1) {
      errorValidacion = validateP2PPaso1(formData);
    } else if (pasoActual === 2) {
      errorValidacion = validateP2PPaso2(formData);
    }

    if (errorValidacion) {
      setErrorMsg(errorValidacion);
      toast.error(errorValidacion);
      return false;
    }

    return true;
  };

  /**
   * Siguiente paso o publicar
   */
  const siguientePaso = async () => {
    setErrorMsg('');

    // Validar paso actual
    if (!validarPasoActual()) {
      return;
    }

    // Si estamos en el último paso, publicar
    if (pasoActual === 3) {
      await publicarOferta();
    } else {
      // Avanzar al siguiente paso
      setPasoActual(pasoActual + 1);
    }
  };

  /**
   * Paso anterior
   */
  const anteriorPaso = () => {
    if (pasoActual > 1) {
      setPasoActual(pasoActual - 1);
      setErrorMsg('');
    }
  };

  /**
   * Publicar oferta
   */
  const publicarOferta = async () => {
    try {
      console.log('📝 Publicando oferta con datos:', formData);

      await createOfertaAsync(formData);

      toast.success('¡Oferta publicada exitosamente!');
      
      setTimeout(() => {
        navigate('/p2p');
      }, 1500);
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Error al crear la oferta';
      setErrorMsg(errorMessage);
      toast.error(errorMessage);
    }
  };

  // Loading inicial
  if (loadingCryptos || loadingMetodos) {
    return (
      <div className="crear-oferta-p2p">
        <div className="loading-spinner">Cargando datos...</div>
      </div>
    );
  }

  return (
    <div className="crear-oferta-p2p">
      {/* Header */}
      <header className="crear-oferta-header">
        <h1 className="crear-oferta-titulo">Publicar anuncio P2P</h1>
      </header>

      {/* Stepper */}
      <StepperWizard pasoActual={pasoActual} />

      {/* Mensaje de error */}
      {errorMsg && (
        <div className="mensaje-error">
          <span className="icono-error">⚠</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Contenido del wizard */}
      <div className="wizard-content">
        {pasoActual === 1 && (
          <Paso1TipoPrecio
            formData={formData}
            criptomonedas={criptomonedas}
            onInputChange={handleInputChange}
          />
        )}

        {pasoActual === 2 && (
          <Paso2ImportePago
            formData={formData}
            criptomonedas={criptomonedas}
            metodosPago={metodosPago}
            onInputChange={handleInputChange}
            onToggleMetodoPago={toggleMetodoPago}
          />
        )}

        {pasoActual === 3 && (
          <Paso3Confirmacion
            formData={formData}
            criptomonedas={criptomonedas}
            onInputChange={handleInputChange}
          />
        )}
      </div>

      {/* Botones de navegación */}
      <div className="wizard-actions">
        {pasoActual > 1 && (
          <button 
            className="btn-anterior" 
            onClick={anteriorPaso} 
            disabled={isCreating}
          >
            Anterior
          </button>
        )}
        <button
          className="btn-siguiente"
          onClick={siguientePaso}
          disabled={isCreating}
        >
          {pasoActual === 3 
            ? (isCreating ? 'Publicando...' : 'Publicar oferta') 
            : 'Siguiente'
          }
        </button>
      </div>
    </div>
  );
};

export default CrearOfertaP2P;