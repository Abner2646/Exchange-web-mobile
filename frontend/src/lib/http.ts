export type ApiErrorPayload = { error?: { code?: string; message?: string } };

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); }
}

const baseUrl = import.meta.env.VITE_API_URL ?? '/api';

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  const token = localStorage.getItem('token');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers, credentials: 'include' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ApiErrorPayload;
    throw new ApiError(response.status, body.error?.code ?? 'INTERNAL_ERROR', body.error?.message ?? 'Request failed.');
  }
  return response.json() as Promise<T>;
}

export function newIdempotencyKey(): string { return crypto.randomUUID(); }
