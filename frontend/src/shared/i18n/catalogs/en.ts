import { Catalog } from '../types';

export const en: Catalog = {
  ui: {
    'common.submit': 'Submit',
    'common.cancel': 'Cancel',
    'common.loading': 'Loading...',
    'greeting': 'Hello, {{name}}!',
  },
  errors: {
    'INTERNAL_ERROR': 'An unexpected error occurred. Please try again. Request ID: {{requestId}}',
    'IDEMPOTENCY_KEY_REQUIRED': 'A system error occurred (missing idempotency key).',
    'IDEMPOTENCY_REQUEST_IN_PROGRESS': 'Your request is still processing, please wait.',
    'IDEMPOTENCY_KEY_REUSED': 'This request was already submitted.',
    'WITHDRAWAL_COOLDOWN': 'Withdrawals are currently disabled due to a recent security change.',
    'OPERATOR_MFA_REQUIRED': 'Operator MFA is required.',
    'OPERATOR_REQUIRED': 'Operator access is required.',
    'BALANCE_INVALID_INPUT': 'Invalid balance input parameters.',
    'BALANCE_INSUFFICIENT': 'Insufficient funds in the selected compartment.',
    'P2P_TX_OFFER_INACTIVE': 'This P2P offer is no longer active.',
    'P2P_TX_AMOUNT_OUT_OF_RANGE': 'The transaction amount is out of range for this offer.',
    'P2P_TX_INSUFFICIENT_FUNDS': 'The seller does not have sufficient funds.',
    'P2P_TX_OFFER_NOT_FOUND': 'The P2P offer was not found.',
    'P2P_TX_OWN_OFFER': 'You cannot transact with your own offer.',
    'P2P_TX_INVALID_STATE': 'The transaction cannot proceed in its current state.',
    'P2P_TX_FORBIDDEN': 'You do not have permission to perform this action.',
    'P2P_TX_NOT_FOUND': 'The P2P transaction was not found.',
    'EMAIL_CHANGE_INVALID': 'Invalid email change request.',
    'FALLBACK_UNKNOWN_ERROR': 'An unknown error occurred (Code: {{code}}).',
  }
};
