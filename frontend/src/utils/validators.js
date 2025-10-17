// src/utils/validators.js

// ============================================
// VALIDACIONES DE REGISTRO (EXISTENTES)
// ============================================

// Validar formulario de registro
export const validateRegistrationForm = (formData) => {
  const errors = {};

  // Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!formData.email) {
    errors.email = 'El email es requerido';
  } else if (!emailRegex.test(formData.email)) {
    errors.email = 'Ingresa un email válido';
  }

  // Username
  if (!formData.username) {
    errors.username = 'El usuario es requerido';
  } else if (formData.username.length < 3) {
    errors.username = 'El usuario debe tener al menos 3 caracteres';
  }

  // Password
  if (!formData.password) {
    errors.password = 'La contraseña es requerida';
  } else if (formData.password.length < 8) {
    errors.password = 'La contraseña debe tener al menos 8 caracteres';
  }

  // Confirm Password
  if (!formData.confirmPassword) {
    errors.confirmPassword = 'Debes confirmar la contraseña';
  } else if (formData.password !== formData.confirmPassword) {
    errors.confirmPassword = 'Las contraseñas no coinciden';
  }

  // País
  if (!formData.pais) {
    errors.pais = 'El país es requerido';
  }

  return errors;
};

// Otras validaciones reutilizables...
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password) => {
  return password && password.length >= 8;
};

// Alias para compatibilidad con código original
export const isValidEmail = validateEmail;

// ============================================
// VALIDACIONES DE TRANSFERENCIAS (EXISTENTES)
// ============================================

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateTransferForm = (formData) => {
  const errors = {};

  if (!formData.destinatario) {
    errors.destinatario = 'Debes seleccionar un destinatario válido';
  }

  if (!formData.email) {
    errors.email = 'El email es requerido';
  } else if (!EMAIL_REGEX.test(formData.email)) {
    errors.email = 'Email inválido';
  }

  if (!formData.criptoSeleccionada) {
    errors.crypto = 'Debes seleccionar una criptomoneda';
  }

  const cantidad = parseFloat(formData.cantidad);
  if (!formData.cantidad || isNaN(cantidad) || cantidad <= 0) {
    errors.cantidad = 'La cantidad debe ser mayor a 0';
  }

  if (formData.balanceInsuficiente) {
    errors.balance = 'Balance insuficiente';
  }

  console.log('🔍 Validación de formulario:', { formData, errors });

  return errors;
};

export const validateVerificationCode = (code) => {
  if (Array.isArray(code)) {
    const codeString = code.join('');
    return codeString.length === 6 && /^\d{6}$/.test(codeString);
  }
  return code.length === 6 && /^\d{6}$/.test(code);
};

export const validateDifferentUser = (destinatario, currentUser) => {
  if (!destinatario || !currentUser) return false;
  return destinatario.id !== currentUser.id;
};

export const validateTransferAmount = (cantidad, balance) => {
  const amount = parseFloat(cantidad);
  const availableBalance = parseFloat(balance);

  if (isNaN(amount) || isNaN(availableBalance)) {
    return false;
  }

  return amount > 0 && amount <= availableBalance;
};

export const validateTransferNote = (nota) => {
  if (!nota) return true;
  return nota.length <= 200;
};

// ============================================
// VALIDACIONES DE RETIROS (EXISTENTES)
// ============================================

export const validateWithdrawalAddress = (address, network = '') => {
  if (!address) {
    return { isValid: false, error: 'La direccion es requerida' };
  }

  if (address.length < 26) {
    return { isValid: false, error: 'Direccion demasiado corta' };
  }

  const normalizedNetwork = network.toLowerCase();
  if (normalizedNetwork === 'ethereum' || normalizedNetwork === 'bsc') {
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return { isValid: false, error: 'Direccion Ethereum invalida' };
    }
  }

  return { isValid: true, error: '' };
};

export const validateWithdrawalAmount = (amount, balance, minAmount = 0.00000001) => {
  const numAmount = parseFloat(amount);
  const availableBalance = parseFloat(balance);

  if (!amount || isNaN(numAmount)) {
    return { isValid: false, error: 'Ingresa una cantidad valida' };
  }

  if (numAmount <= 0) {
    return { isValid: false, error: 'La cantidad debe ser mayor a 0' };
  }

  if (numAmount < minAmount) {
    return { isValid: false, error: 'Cantidad por debajo del minimo permitido' };
  }

  if (numAmount > availableBalance) {
    return { isValid: false, error: 'Cantidad excede balance disponible' };
  }

  return { isValid: true, error: '' };
};

export const validateWithdrawalForm = (formData) => {
  const errors = {};

  if (!formData.selectedCrypto) {
    errors.crypto = 'Selecciona una criptomoneda';
  }

  const addressValidation = validateWithdrawalAddress(
    formData.destinationAddress,
    formData.selectedCrypto?.red
  );
  if (!addressValidation.isValid) {
    errors.address = addressValidation.error;
  }

  const amountValidation = validateWithdrawalAmount(
    formData.amount,
    formData.balance
  );
  if (!amountValidation.isValid) {
    errors.amount = amountValidation.error;
  }

  console.log('🔍 Validación de formulario de retiro:', { formData, errors });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// ============================================
// VALIDACIONES DE P2P (EXISTENTES)
// ============================================

export const validateP2PPaso1 = (formData) => {
  if (!formData.criptomonedaId) {
    return 'Por favor, selecciona una criptomoneda';
  }
  
  const precio = parseFloat(formData.precioUnitario);
  if (!formData.precioUnitario || isNaN(precio) || precio <= 0) {
    return 'Por favor, ingresa un precio unitario válido';
  }
  
  return null;
};

export const validateP2PPaso2 = (formData) => {
  const cantidadMin = parseFloat(formData.cantidadMin);
  const cantidadMax = parseFloat(formData.cantidadMax);
  
  if (!formData.cantidadMin || isNaN(cantidadMin) || cantidadMin <= 0) {
    return 'Por favor, ingresa una cantidad mínima válida';
  }
  
  if (!formData.cantidadMax || isNaN(cantidadMax) || cantidadMax <= 0) {
    return 'Por favor, ingresa una cantidad máxima válida';
  }
  
  if (cantidadMin >= cantidadMax) {
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

export const canAddMetodoPago = (metodosSeleccionados, maxMetodos = 5) => {
  return metodosSeleccionados.length < maxMetodos;
};

export const validateDireccionFiat = (direccion) => {
  if (!direccion || direccion.trim() === '') {
    return { isValid: false, error: 'La dirección de pago es requerida' };
  }
  
  if (direccion.length < 5) {
    return { isValid: false, error: 'La dirección de pago es demasiado corta' };
  }
  
  return { isValid: true, error: '' };
};

// ============================================
// ⭐ VALIDACIONES DE CAMBIO DE CONTRASEÑA (NUEVAS)
// ============================================

/**
 * Validar formulario de cambio de contraseña
 * @param {Object} passwordForm - Datos del formulario
 * @param {String} passwordForm.currentPassword - Contraseña actual
 * @param {String} passwordForm.newPassword - Nueva contraseña
 * @param {String} passwordForm.confirmPassword - Confirmar nueva contraseña
 * @returns {Object} { isValid: boolean, errors: object }
 */
export const validatePasswordChange = (passwordForm) => {
  const errors = {};

  // Validar contraseña actual
  if (!passwordForm.currentPassword) {
    errors.currentPassword = 'La contraseña actual es requerida';
  }

  // Validar nueva contraseña
  if (!passwordForm.newPassword) {
    errors.newPassword = 'La nueva contraseña es requerida';
  } else if (passwordForm.newPassword.length < 6) {
    errors.newPassword = 'La nueva contraseña debe tener al menos 6 caracteres';
  }

  // Validar confirmación de contraseña
  if (!passwordForm.confirmPassword) {
    errors.confirmPassword = 'Debes confirmar la nueva contraseña';
  } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    errors.confirmPassword = 'Las contraseñas no coinciden';
  }

  console.log('🔍 Validación de cambio de contraseña:', { errors });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Validar fortaleza de contraseña (opcional para feedback visual)
 * @param {String} password
 * @returns {Object} { strength: 'weak'|'medium'|'strong', score: 0-100 }
 */
export const validatePasswordStrength = (password) => {
  if (!password) return { strength: 'weak', score: 0 };

  let score = 0;

  // Longitud
  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 25;

  // Complejidad
  if (/[a-z]/.test(password)) score += 10; // minúsculas
  if (/[A-Z]/.test(password)) score += 10; // mayúsculas
  if (/[0-9]/.test(password)) score += 15; // números
  if (/[^a-zA-Z0-9]/.test(password)) score += 15; // caracteres especiales

  let strength = 'weak';
  if (score >= 60) strength = 'medium';
  if (score >= 80) strength = 'strong';

  return { strength, score };
};

// VALIDACIONES DE SWAP
// ============================================

/**
 * Validar cantidad de swap
 * @param {String|Number} amount - Cantidad a intercambiar
 * @param {Number} balance - Balance disponible
 * @returns {Object} { isValid: boolean, error: string }
 */
export const validateSwapAmount = (amount, balance) => {
  const numAmount = parseFloat(amount);
  const availableBalance = parseFloat(balance);

  if (!amount || isNaN(numAmount)) {
    return { isValid: false, error: 'Ingresa una cantidad válida' };
  }

  if (numAmount <= 0) {
    return { isValid: false, error: 'La cantidad debe ser mayor a 0' };
  }

  if (numAmount > availableBalance) {
    return { isValid: false, error: 'Balance insuficiente' };
  }

  return { isValid: true, error: '' };
};

/**
 * Validar par de swap (no puede ser la misma moneda)
 * @param {Object} fromCrypto - Criptomoneda origen
 * @param {Object} toCrypto - Criptomoneda destino
 * @returns {Object} { isValid: boolean, error: string }
 */
export const validateSwapPair = (fromCrypto, toCrypto) => {
  if (!fromCrypto) {
    return { isValid: false, error: 'Selecciona una criptomoneda de origen' };
  }

  if (!toCrypto) {
    return { isValid: false, error: 'Selecciona una criptomoneda de destino' };
  }

  if (fromCrypto.id === toCrypto.id) {
    return { isValid: false, error: 'No puedes intercambiar la misma criptomoneda' };
  }

  return { isValid: true, error: '' };
};

/**
 * Validar formulario completo de swap
 * @param {Object} swapData - Datos del swap
 * @returns {Object} { isValid: boolean, errors: object }
 */
export const validateSwapForm = (swapData) => {
  const errors = {};

  // Validar criptomonedas
  const pairValidation = validateSwapPair(swapData.fromCrypto, swapData.toCrypto);
  if (!pairValidation.isValid) {
    errors.pair = pairValidation.error;
  }

  // Validar cantidad
  const amountValidation = validateSwapAmount(swapData.fromAmount, swapData.balance);
  if (!amountValidation.isValid) {
    errors.amount = amountValidation.error;
  }

  console.log('🔍 Validación de formulario de swap:', { swapData, errors });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};


export default {
  // Registro
  validateRegistrationForm,
  validateEmail,
  validatePassword,
  isValidEmail,
  
  // Transferencias
  EMAIL_REGEX,
  validateTransferForm,
  validateVerificationCode,
  validateDifferentUser,
  validateTransferAmount,
  validateTransferNote,
  
  // Retiros
  validateWithdrawalAddress,
  validateWithdrawalAmount,
  validateWithdrawalForm,
  
  // P2P
  validateP2PPaso1,
  validateP2PPaso2,
  canAddMetodoPago,
  validateDireccionFiat,

  // Cambio de Contraseña
  validatePasswordChange,
  validatePasswordStrength,

  // Swap (NUEVOS)
  validateSwapAmount,
  validateSwapPair,
  validateSwapForm,
};