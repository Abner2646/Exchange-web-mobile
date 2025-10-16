import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import adminService from '../services/adminService';
import authService from '../services/authService';
import { isValidEmail } from '../utils/validators';

export const useAdmin = () => {
  const queryClient = useQueryClient();

  // Estados del formulario de balance
  const [userEmail, setUserEmail] = useState('');
  const [userLookup, setUserLookup] = useState(null);
  const [criptoSeleccionada, setCriptoSeleccionada] = useState(null);
  const [searchCrypto, setSearchCrypto] = useState('');
  const [showCryptoDropdown, setShowCryptoDropdown] = useState(false);
  const [amount, setAmount] = useState('');

  // Estados del formulario de método de pago
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');

  // Estados del modal de confirmación
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmStep, setConfirmStep] = useState(1);

  // Referencias
  const dropdownRef = useRef(null);
  const cryptoSearchRef = useRef(null);

  // Query: Obtener información del usuario actual
  const {
    data: userInfo,
    isLoading: loadingUser,
    error: userError,
  } = useQuery(
    'adminUserInfo',
    () => authService.getProfile(), // ✅ CORREGIDO: método correcto
    {
      staleTime: 300000, // 5 minutos
      onSuccess: (data) => {
        console.log('✅ [useAdmin] User data loaded:', data);
        console.log('✅ [useAdmin] User rol:', data?.rol);
      },
      onError: (error) => {
        console.error('❌ [useAdmin] Error loading user:', error);
      },
    }
  );

  // Query: Obtener criptomonedas activas
  const {
    data: criptomonedas = [],
    isLoading: loadingCryptos,
  } = useQuery('activeCryptocurrencies', () => adminService.getActiveCryptocurrencies(), {
    staleTime: 60000, // 1 minuto
  });

  // Mutation: Inicializar wallets
  const initializeWalletsMutation = useMutation(
    () => adminService.initializeWallets(),
    {
      onSuccess: () => {
        toast.success('Operación completada exitosamente');
      },
      onError: (error) => {
        toast.error(`Error: ${error.response?.data?.message || error.message}`);
      },
    }
  );

  // Mutation: Actualizar balance de usuario
  const updateBalanceMutation = useMutation(
    ({ userId, cryptoId, amount }) =>
      adminService.updateUserBalance(userId, cryptoId, amount),
    {
      onSuccess: () => {
        toast.success('Operación completada exitosamente');
        // Limpiar formulario
        setUserEmail('');
        setUserLookup(null);
        setCriptoSeleccionada(null);
        setAmount('');
      },
      onError: (error) => {
        toast.error(`Error: ${error.response?.data?.message || error.message}`);
      },
    }
  );

  // Mutation: Generar pares de exchange
  const generatePairsMutation = useMutation(
    () => adminService.generateExchangePairs(),
    {
      onSuccess: () => {
        toast.success('Operación completada exitosamente');
      },
      onError: (error) => {
        toast.error(`Error: ${error.response?.data?.message || error.message}`);
      },
    }
  );

  // Mutation: Crear método de pago
  const createPaymentMethodMutation = useMutation(
    ({ nombre, descripcion }) => adminService.createPaymentMethod(nombre, descripcion),
    {
      onSuccess: () => {
        toast.success('Operación completada exitosamente');
        // Limpiar formulario
        setNombre('');
        setDescripcion('');
      },
      onError: (error) => {
        toast.error(`Error: ${error.response?.data?.message || error.message}`);
      },
    }
  );

  // Búsqueda de usuario con debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (userEmail && isValidEmail(userEmail)) {
        try {
          const result = await adminService.searchUserByEmail(userEmail);
          setUserLookup(result);
        } catch (err) {
          console.error('Error looking up user:', err);
          setUserLookup({ found: false });
        }
      } else {
        setUserLookup(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [userEmail]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCryptoDropdown(false);
      }
    };

    if (showCryptoDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      cryptoSearchRef.current?.focus();
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCryptoDropdown]);

  // Handlers para operaciones sensibles
  const handleSensitiveAction = (action) => {
    setConfirmAction(action);
    setConfirmStep(1);
    setShowConfirmModal(true);
  };

  const handleConfirmNext = () => {
    if (confirmStep === 1) {
      setConfirmStep(2);
    } else if (confirmStep === 2) {
      setShowConfirmModal(false);
      setConfirmStep(1);
      
      if (confirmAction === 'initializeWallets') {
        initializeWalletsMutation.mutate();
      } else if (confirmAction === 'generatePairs') {
        generatePairsMutation.mutate();
      }
      
      setConfirmAction(null);
    }
  };

  const handleConfirmCancel = () => {
    setShowConfirmModal(false);
    setConfirmStep(1);
    setConfirmAction(null);
  };

  // Handler para actualizar balance
  const handleUpdateBalance = () => {
    if (!userEmail || !criptoSeleccionada || !amount) {
      toast.error('Por favor completa todos los campos de Actualizar Balance');
      return;
    }

    if (!userLookup || !userLookup.found) {
      toast.error('Usuario no encontrado. Verifica el email.');
      return;
    }

    updateBalanceMutation.mutate({
      userId: userLookup.userId,
      cryptoId: criptoSeleccionada.id,
      amount,
    });
  };

  // Handler para crear método de pago
  const handleCreatePaymentMethod = () => {
    if (!nombre || !descripcion) {
      toast.error('Por favor completa todos los campos de Crear Método de Pago');
      return;
    }

    createPaymentMethodMutation.mutate({ nombre, descripcion });
  };

  // Filtrar criptomonedas
  const criptosFiltradas = criptomonedas.filter(
    (crypto) =>
      crypto.nombre.toLowerCase().includes(searchCrypto.toLowerCase()) ||
      crypto.symbol.toLowerCase().includes(searchCrypto.toLowerCase())
  );

  // 🐛 DEBUG LOG
  console.log('🔍 [useAdmin] Current state:', {
    userInfo,
    loadingUser,
    userError,
    hasError: !!userError,
    rol: userInfo?.rol,
  });

  return {
    // User info
    userInfo,
    isLoading: loadingUser || loadingCryptos,
    hasError: !!userError,

    // Balance form
    userEmail,
    setUserEmail,
    userLookup,
    criptomonedas,
    criptoSeleccionada,
    setCriptoSeleccionada,
    searchCrypto,
    setSearchCrypto,
    showCryptoDropdown,
    setShowCryptoDropdown,
    amount,
    setAmount,
    criptosFiltradas,

    // Payment method form
    nombre,
    setNombre,
    descripcion,
    setDescripcion,

    // Modal
    showConfirmModal,
    confirmAction,
    confirmStep,
    handleConfirmNext,
    handleConfirmCancel,

    // Refs
    dropdownRef,
    cryptoSearchRef,

    // Actions
    handleSensitiveAction,
    handleUpdateBalance,
    handleCreatePaymentMethod,

    // Loading states
    loadingStates: {
      card1: initializeWalletsMutation.isLoading,
      card2: updateBalanceMutation.isLoading,
      card3: generatePairsMutation.isLoading,
      card4: createPaymentMethodMutation.isLoading,
    },
  };
};