/**
 * shared/api/client.ts
 *
 * Typed fetch transport.
 * Attaches auth from session, attaches Idempotency-Key on money mutations,
 * decodes errors, returns typed data. No direct fetch outside this file.
 */

import { ApiError } from './errors';
import { session } from './session';
import { generateIdempotencyKey, isMoneyEndpoint } from './idempotency';

const DEFAULT_BASE_URL =
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) || '/api';

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown; // Accepting object payload for JSON requests
  idempotencyKey?: string;
}

/**
 * Creates an ApiError or parses successful payload
 */
async function handleResponse<T>(response: Response): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = null;
  const contentType = response.headers.get('content-type');
  
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      // Body not readable as JSON
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      session.notifyUnauthorized();
    }
    throw ApiError.fromResponse(data, response.status);
  }

  return data as T;
}

/**
 * Helper to build common headers.
 */
function buildHeaders(url: string, method: string, customHeaders?: HeadersInit, idempotencyKey?: string): Headers {
  const headers = new Headers(customHeaders);
  
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  
  const token = session.getToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const explicitKey = idempotencyKey || (headers.get('Idempotency-Key') ?? undefined);
  if (explicitKey) {
    headers.set('Idempotency-Key', explicitKey);
  } else if (isMoneyEndpoint(url, method)) {
    headers.set('Idempotency-Key', generateIdempotencyKey());
  }

  return headers;
}

/**
 * Perform a typed fetch request.
 */
export async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers: customHeaders, idempotencyKey, ...fetchOptions } = options;
  
  const method = fetchOptions.method || 'GET';
  const url = endpoint.startsWith('http') ? endpoint : `${DEFAULT_BASE_URL}${endpoint}`;
  
  const headers = buildHeaders(endpoint, method, customHeaders, idempotencyKey);
  
  const finalOptions: RequestInit = {
    ...fetchOptions,
    method,
    headers,
  };

  if (body) {
    finalOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, finalOptions);
    return handleResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromNetworkError(error);
  }
}

/**
 * Singleton client simulating axios interface with typed methods.
 */
export const apiClient = {
  get: <T>(url: string, options?: Omit<RequestOptions, 'method' | 'body'>) => 
    apiFetch<T>(url, { ...options, method: 'GET' }),
    
  post: <T>(url: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) => 
    apiFetch<T>(url, { ...options, method: 'POST', body }),
    
  put: <T>(url: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) => 
    apiFetch<T>(url, { ...options, method: 'PUT', body }),
    
  patch: <T>(url: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) => 
    apiFetch<T>(url, { ...options, method: 'PATCH', body }),
    
  delete: <T>(url: string, options?: Omit<RequestOptions, 'method' | 'body'>) => 
    apiFetch<T>(url, { ...options, method: 'DELETE' }),
};

// Exporting createApiClient to keep backwards compatibility if something uses it,
// though fetch doesn't need to be instantiated the same way axios does.
export function createApiClient(options: { baseURL?: string } = {}) {
  // Can expand to handle instance-level baseURL if needed, but keeping simple for now.
  return apiClient;
}
