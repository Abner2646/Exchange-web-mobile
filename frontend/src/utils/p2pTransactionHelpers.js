/**
 * Determinar si el usuario es comprador en una transacción
 * @param {Object} transaccion - Transacción P2P
 * @param {String} userId - ID del usuario actual
 * @returns {Boolean}
 */
export const esMiCompra = (transaccion, userId) => {
  return transaccion?.compradorId === userId;
};

/**
 * Determinar si el usuario es vendedor en una transacción
 * @param {Object} transaccion - Transacción P2P
 * @param {String} userId - ID del usuario actual
 * @returns {Boolean}
 */
export const esMiVenta = (transaccion, userId) => {
  return transaccion?.vendedorId === userId;
};

/**
 * Obtener el rol del usuario en una transacción
 * @param {Object} transaccion - Transacción P2P
 * @param {String} userId - ID del usuario actual
 * @returns {String} - 'buyer', 'seller', o 'unknown'
 */
export const obtenerRolUsuario = (transaccion, userId) => {
  if (esMiCompra(transaccion, userId)) return 'buyer';
  if (esMiVenta(transaccion, userId)) return 'seller';
  return 'unknown';
};

/**
 * Determinar si una transacción puede ser cancelada
 * Solo se puede cancelar en estados: iniciada, pago_confirmado
 * @param {String} estado - Estado de la transacción
 * @returns {Boolean}
 */
export const puedeCancelarTransaccion = (estado) => {
  return estado === 'iniciada' || estado === 'pago_confirmado';
};

/**
 * Determinar si el comprador puede confirmar pago
 * @param {Object} transaccion - Transacción P2P
 * @param {String} userId - ID del usuario actual
 * @returns {Boolean}
 */
export const puedeConfirmarPago = (transaccion, userId) => {
  return (
    transaccion.estado === 'iniciada' &&
    esMiCompra(transaccion, userId)
  );
};

/**
 * Determinar si el vendedor puede liberar criptos
 * @param {Object} transaccion - Transacción P2P
 * @param {String} userId - ID del usuario actual
 * @returns {Boolean}
 */
export const puedeLiberarCriptos = (transaccion, userId) => {
  return (
    transaccion.estado === 'pago_confirmado' &&
    esMiVenta(transaccion, userId)
  );
};

/**
 * Obtener etiqueta de estado en español
 * @param {String} estado - Estado de la transacción
 * @returns {String}
 */
export const obtenerEtiquetaEstado = (estado) => {
  const etiquetas = {
    'iniciada': 'Iniciada',
    'pago_confirmado': 'Pago Confirmado',
    'completada': 'Completada',
    'cancelada': 'Cancelada',
    'disputada': 'En Disputa',
  };
  
  return etiquetas[estado] || estado;
};

/**
 * Obtener texto del rol en español
 * @param {String} rol - 'buyer' o 'seller'
 * @returns {String}
 */
export const obtenerTextoRol = (rol) => {
  return rol === 'buyer' ? 'Comprador' : 'Vendedor';
};

/**
 * Obtener contraparte de la transacción
 * @param {Object} transaccion - Transacción P2P
 * @param {String} userId - ID del usuario actual
 * @returns {Object|null} - Objeto con username y datos de contraparte
 */
export const obtenerContraparte = (transaccion, userId) => {
  if (esMiCompra(transaccion, userId)) {
    return {
      rol: 'Vendedor',
      username: transaccion.vendedor?.username || 'Usuario',
      userData: transaccion.vendedor,
    };
  }
  
  if (esMiVenta(transaccion, userId)) {
    return {
      rol: 'Comprador',
      username: transaccion.comprador?.username || 'Usuario',
      userData: transaccion.comprador,
    };
  }
  
  return null;
};

export default {
  esMiCompra,
  esMiVenta,
  obtenerRolUsuario,
  puedeCancelarTransaccion,
  puedeConfirmarPago,
  puedeLiberarCriptos,
  obtenerEtiquetaEstado,
  obtenerTextoRol,
  obtenerContraparte,
};