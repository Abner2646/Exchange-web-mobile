// src/pages/Transferencia.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCryptos } from '../hooks/useCrypto';
import { useBalances } from '../hooks/useBalances';
import { useTransfers } from '../hooks/useTransfers';
import { useUserSearch } from '../hooks/useUserSearch';
import TransferForm from '../components/features/TransferForm';
import TransferSummary from '../components/features/TransferSummary';
import VerificationModal from '../components/features/VerificationModal';
import TransferHistory from '../components/features/TransferHistory';
import SuccessAnimation from '../components/features/SuccessAnimation';
import Toast from '../components/common/Toast';
import '../styles/Transferencia.css';

export default function Transferencia() {
  const { user, isAuthenticated } = useAuth();

  // Estados del formulario
  const [email, setEmail] = useState('');
  const [criptoSeleccionada, setCriptoSeleccionada] = useState(null);
  const [cantidad, setCantidad] = useState('');
  const [nota, setNota] = useState('');
  const [balanceInsuficiente, setBalanceInsuficiente] = useState(false);
  const [error, setError] = useState('');

  // Estados del modal
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [transferId, setTransferId] = useState(null);

  // Estados de UI
  const [toast, setToast] = useState(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  // Hooks personalizados
  const { cryptos: criptomonedas = [], isLoading: loadingCryptos } = useCryptos();
  const { balances = [] } = useBalances();
  
  // ⭐ CAMBIO: Pasar user.id al hook
  const {
    transfers,
    allTransfers,
    isLoading: loadingHistorial,
    verifyFunds,
    createTransfer,
    processTransfer,
    resendCode,
    filters,
    setFilters,
    counts, // ⭐ NUEVO: Contadores para tabs
  } = useTransfers(user?.id);

  const {
    destinatario,
    searching: searchingUser,
    notFound: userNotFound,
    error: searchError,
    setDestinatario,
    setError: setSearchError,
  } = useUserSearch(email);

  // Redirigir si no está autenticado
  useEffect(() => {
    if (!isAuthenticated) {
      window.location.href = '/login';
    }
  }, [isAuthenticated]);

  // Verificar balance cuando cambia la cantidad o crypto
  useEffect(() => {
    const checkBalance = async () => {
      if (criptoSeleccionada && cantidad && parseFloat(cantidad) > 0) {
        try {
          const tieneFondos = await verifyFunds({
            cryptoId: criptoSeleccionada.id,
            amount: parseFloat(cantidad),
          });
          setBalanceInsuficiente(!tieneFondos);
          console.log('💰 Verificación de fondos:', { tieneFondos, cantidad });
        } catch (err) {
          console.error('❌ Error verificando fondos:', err);
        }
      } else {
        setBalanceInsuficiente(false);
      }
    };

    checkBalance();
  }, [cantidad, criptoSeleccionada, verifyFunds]);

  // Toast auto-hide
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Sincronizar error de búsqueda
  useEffect(() => {
    if (searchError) {
      setError(searchError);
    }
  }, [searchError]);

  const handleSelectRecipient = (recipient) => {
    setEmail(recipient.email || '');
    setDestinatario(recipient);
    setSearchError('');
    console.log('👤 Destinatario seleccionado:', recipient.username);
  };

  const handleEnviarTransferencia = async () => {
    if (!destinatario || !criptoSeleccionada || !cantidad || parseFloat(cantidad) <= 0) {
      setError('Por favor completa todos los campos correctamente');
      showToast('Por favor completa todos los campos', 'error');
      return;
    }

    if (balanceInsuficiente) {
      setError('Balance insuficiente para realizar la transferencia');
      showToast('Balance insuficiente', 'error');
      return;
    }

    try {
      console.log('📤 Enviando transferencia...');
      const result = await createTransfer.mutateAsync({
        destinatarioId: destinatario.id,
        cryptoId: criptoSeleccionada.id,
        cantidad: parseFloat(cantidad),
        nota: nota || undefined,
      });

      setTransferId(result.data.id);
      setShowVerificationModal(true);
      setError('');
      console.log('✅ Transferencia creada, ID:', result.data.id);
    } catch (err) {
      console.error('❌ Error creando transferencia:', err);
      const errorMsg = err.response?.data?.error || 'Error al crear la transferencia';
      setError(errorMsg);
    }
  };

  const handleVerificarCodigo = async (codigo) => {
    try {
      console.log('🔐 Verificando código...');
      await processTransfer.mutateAsync({
        transferId,
        codigo,
      });

      // Éxito
      setShowVerificationModal(false);
      setShowSuccessAnimation(true);
      setError('');

      setTimeout(() => {
        setShowSuccessAnimation(false);
        resetForm();

        setTimeout(() => {
          document.querySelector('.historial-section')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }, 500);
      }, 2000);

      console.log('✅ Transferencia completada exitosamente');
    } catch (err) {
      console.error('❌ Error verificando código:', err);
      const errorMsg = err.response?.data?.error || 'Código incorrecto';
      setError(errorMsg);
    }
  };

  const handleReenviarCodigo = async () => {
    try {
      console.log('🔄 Reenviando código...');
      await resendCode.mutateAsync(transferId);
    } catch (err) {
      console.error('❌ Error reenviando código:', err);
    }
  };

  const resetForm = () => {
    setEmail('');
    setDestinatario(null);
    setCriptoSeleccionada(null);
    setCantidad('');
    setNota('');
    setTransferId(null);
    setError('');
    console.log('🔄 Formulario reseteado');
  };

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const puedeEnviar =
    destinatario &&
    criptoSeleccionada &&
    cantidad &&
    parseFloat(cantidad) > 0 &&
    !balanceInsuficiente &&
    !createTransfer.isLoading;

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="transferencia-container">
      <div className="transferencia-content">
        <h1 className="transferencia-title">Transferir Criptomonedas</h1>

        <div className="transferencia-layout">
          {/* Columna izquierda - Formulario */}
          <div className="transferencia-form-column">
            <TransferForm
              email={email}
              setEmail={setEmail}
              destinatario={destinatario}
              searching={searchingUser}
              notFound={userNotFound}
              historial={allTransfers}
              onSelectRecipient={handleSelectRecipient}
              criptomonedas={criptomonedas}
              criptoSeleccionada={criptoSeleccionada}
              onSelectCrypto={setCriptoSeleccionada}
              cantidad={cantidad}
              setCantidad={setCantidad}
              balances={balances}
              balanceInsuficiente={balanceInsuficiente}
              nota={nota}
              setNota={setNota}
            />
          </div>

          {/* Columna derecha - Resumen */}
          <div className="transferencia-summary-column">
            <TransferSummary
              criptoSeleccionada={criptoSeleccionada}
              destinatario={destinatario}
              cantidad={cantidad}
              balances={balances}
              onSubmit={handleEnviarTransferencia}
              canSubmit={puedeEnviar}
              loading={createTransfer.isLoading}
              error={error}
            />
          </div>
        </div>

        {/* Historial - ⭐ NUEVO: Pasar counts */}
        <TransferHistory
          transfers={transfers}
          loading={loadingHistorial}
          filters={filters}
          setFilters={setFilters}
          counts={counts}
        />
      </div>

      {/* Modal de verificación */}
      <VerificationModal
        show={showVerificationModal}
        onClose={() => {
          setShowVerificationModal(false);
          setError('');
        }}
        onVerify={handleVerificarCodigo}
        onResend={handleReenviarCodigo}
        verifying={processTransfer.isLoading}
        error={error}
      />

      {/* Animación de éxito */}
      <SuccessAnimation show={showSuccessAnimation} />

      {/* Toast */}
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}