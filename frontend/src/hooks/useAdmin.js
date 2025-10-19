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

  // Estados del selector de stats (completamente separado del balance)
  const [criptoSeleccionadaStats, setCriptoSeleccionadaStats] = useState(null);
  const [searchCryptoStats, setSearchCryptoStats] = useState('');
  const [showCryptoDropdownStats, setShowCryptoDropdownStats] = useState(false);

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
  const dropdownStatsRef = useRef(null);
  const cryptoSearchStatsRef = useRef(null);

  // Query: Obtener información del usuario actual
  const {
    data: userInfo,
    isLoading: loadingUser,
    error: userError,
  } = useQuery(
    'adminUserInfo',
    () => authService.getProfile(),
    {
      staleTime: 300000, // 5 minutos
      retry: false, // No reintentar si falla
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
    retry: 1,
  });

  // Query: Obtener estadísticas de balances
  const {
    data: balanceStats = [],
    isLoading: loadingStats,
    refetch: refetchStats,
  } = useQuery(
    'balanceStats', 
    () => adminService.getBalanceStats(), 
    {
      staleTime: 30000, // 30 segundos
      retry: false, // No reintentar si falla para evitar múltiples 401
      enabled: !!userInfo && userInfo.rol === 'super_admin', // Solo cargar si es super_admin
      onError: (error) => {
        console.error('❌ [useAdmin] Error loading balance stats:', error);
        // No mostrar toast, solo log en consola
      },
    }
  );

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
        // Refrescar estadísticas
        refetchStats();
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

  // Mutation: Generar todos los iconos
  const generateIconsMutation = useMutation(
    () => adminService.generateAllIcons(),
    {
      onSuccess: () => {
        toast.success('Iconos generados exitosamente');
        queryClient.invalidateQueries('activeCryptocurrencies');
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
        // ✅ SOLUCIÓN #2: Permitir que el admin se busque a sí mismo
        // Verificar si el email ingresado es el del usuario actual
        if (userInfo && userInfo.email === userEmail) {
          setUserLookup({
            found: true,
            username: userInfo.username,
            userId: userInfo.id,
            isSelf: true,
          });
          return;
        }

        // Si no es el mismo usuario, buscar en el backend
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
  }, [userEmail, userInfo]);

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

  // Cerrar dropdown de stats al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownStatsRef.current && !dropdownStatsRef.current.contains(event.target)) {
        setShowCryptoDropdownStats(false);
      }
    };

    if (showCryptoDropdownStats) {
      document.addEventListener('mousedown', handleClickOutside);
      cryptoSearchStatsRef.current?.focus();
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCryptoDropdownStats]);

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

  // Handler para cargar stats manualmente
  const handleLoadStats = () => {
    console.log('🔄 Intentando cargar estadísticas...');
    refetchStats();
  };

  // Handler para generar iconos
  const handleGenerateIcons = () => {
    if (window.confirm('¿Estás seguro de que deseas generar todos los iconos de criptomonedas?')) {
      generateIconsMutation.mutate();
    }
  };

  // Filtrar criptomonedas para balance
  const criptosFiltradas = criptomonedas.filter(
    (crypto) =>
      crypto.nombre.toLowerCase().includes(searchCrypto.toLowerCase()) ||
      crypto.symbol.toLowerCase().includes(searchCrypto.toLowerCase())
  );

  // Filtrar criptomonedas para stats
  const criptosFiltadasStats = criptomonedas.filter(
    (crypto) =>
      crypto.nombre.toLowerCase().includes(searchCryptoStats.toLowerCase()) ||
      crypto.symbol.toLowerCase().includes(searchCryptoStats.toLowerCase())
  );

  // Obtener estadísticas de la cripto seleccionada en el panel de stats
  const selectedCryptoStats = criptoSeleccionadaStats
    ? balanceStats.find(stat => stat.criptomonedaId === criptoSeleccionadaStats.id)
    : null;

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

    // Stats selector (separado del balance)
    criptoSeleccionadaStats,
    setCriptoSeleccionadaStats,
    searchCryptoStats,
    setSearchCryptoStats,
    showCryptoDropdownStats,
    setShowCryptoDropdownStats,
    criptosFiltadasStats,

    // Balance stats
    balanceStats,
    loadingStats,
    selectedCryptoStats,
    refetchStats,

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
    dropdownStatsRef,
    cryptoSearchStatsRef,

    // Actions
    handleSensitiveAction,
    handleUpdateBalance,
    handleCreatePaymentMethod,
    handleGenerateIcons,
    handleLoadStats,

    // Loading states
    loadingStates: {
      card1: initializeWalletsMutation.isLoading,
      card2: updateBalanceMutation.isLoading,
      card3: generatePairsMutation.isLoading,
      card4: createPaymentMethodMutation.isLoading,
      card5: generateIconsMutation.isLoading,
    },
  };
};