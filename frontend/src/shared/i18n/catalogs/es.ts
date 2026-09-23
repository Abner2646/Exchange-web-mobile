import { Catalog } from '../types';

export const es: Catalog = {
  ui: {
    'common.submit': 'Enviar',
    'common.cancel': 'Cancelar',
    'common.loading': 'Cargando...',
    'greeting': '¡Hola, {{name}}!',
  },
  errors: {
    'INTERNAL_ERROR': 'Ocurrió un error inesperado. Por favor, inténtalo de nuevo. Request ID: {{requestId}}',
    'IDEMPOTENCY_KEY_REQUIRED': 'Ocurrió un error del sistema (falta la clave de idempotencia).',
    'IDEMPOTENCY_REQUEST_IN_PROGRESS': 'Tu solicitud aún se está procesando, por favor espera.',
    'IDEMPOTENCY_KEY_REUSED': 'Esta solicitud ya fue enviada.',
    'WITHDRAWAL_COOLDOWN': 'Los retiros están deshabilitados actualmente debido a un cambio de seguridad reciente.',
    'OPERATOR_MFA_REQUIRED': 'Se requiere MFA del operador.',
    'OPERATOR_REQUIRED': 'Se requiere acceso de operador.',
    'BALANCE_INVALID_INPUT': 'Parámetros de entrada de balance inválidos.',
    'BALANCE_INSUFFICIENT': 'Fondos insuficientes en el compartimento seleccionado.',
    'P2P_TX_OFFER_INACTIVE': 'Esta oferta P2P ya no está activa.',
    'P2P_TX_AMOUNT_OUT_OF_RANGE': 'El monto de la transacción está fuera de rango para esta oferta.',
    'P2P_TX_INSUFFICIENT_FUNDS': 'El vendedor no tiene fondos suficientes.',
    'P2P_TX_OFFER_NOT_FOUND': 'No se encontró la oferta P2P.',
    'P2P_TX_OWN_OFFER': 'No puedes transaccionar con tu propia oferta.',
    'P2P_TX_INVALID_STATE': 'La transacción no puede continuar en su estado actual.',
    'P2P_TX_FORBIDDEN': 'No tienes permiso para realizar esta acción.',
    'P2P_TX_NOT_FOUND': 'No se encontró la transacción P2P.',
    'EMAIL_CHANGE_INVALID': 'Solicitud de cambio de correo electrónico inválida.',
    'FALLBACK_UNKNOWN_ERROR': 'Ocurrió un error desconocido (Código: {{code}}).',
  }
};
