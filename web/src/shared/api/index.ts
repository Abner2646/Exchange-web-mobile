/**
 * shared/api/index.ts
 *
 * Unified entry point for the HTTP transport and API layer.
 */

export { apiClient, createApiClient, apiFetch } from './client';
export type { RequestOptions } from './client';

export { ApiError, isApiError } from './errors';
export type { ApiErrorParams } from './errors';

export { session } from './session';
export type { SessionStorage } from './session';

export { generateIdempotencyKey, isMoneyEndpoint } from './idempotency';
