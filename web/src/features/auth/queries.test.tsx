import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/app/providers';

const { setToken, clearToken, login, register } = vi.hoisted(() => ({
  setToken: vi.fn(),
  clearToken: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}));

vi.mock('@/shared/api', async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, session: { setToken, clearToken, getToken: () => null, hasToken: () => false } };
});

vi.mock('./api', () => ({ authApi: {
  login: (...a: unknown[]) => login(...a),
  register: (...a: unknown[]) => register(...a),
} }));

import { useLogin, useRegister, USER_QUERY_KEY } from './queries';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = makeQueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => { setToken.mockReset(); login.mockReset(); register.mockReset(); });

describe('auth queries', () => {
  it('useLogin success stores the token for a direct (non-2FA) login', async () => {
    login.mockResolvedValue({ user: { id: '1' }, token: 'jwt' });
    const { result } = renderHook(() => useLogin(), { wrapper });
    result.current.mutate({ email: 'a@b.co', password: 'pw' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(setToken).toHaveBeenCalledWith('jwt');
  });

  it('useLogin does NOT store a token on a 2FA challenge', async () => {
    login.mockResolvedValue({ requires2FA: true, twoFactorMethod: 'totp', temporalToken: 'tt' });
    const { result } = renderHook(() => useLogin(), { wrapper });
    result.current.mutate({ email: 'a@b.co', password: 'pw' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(setToken).not.toHaveBeenCalled();
  });

  it('useRegister stores the temporal token', async () => {
    register.mockResolvedValue({ user: { id: '1' }, token: 'temp', message: 'ok' });
    const { result } = renderHook(() => useRegister(), { wrapper });
    result.current.mutate({ email: 'a@b.co', password: 'pw', username: 'u' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(setToken).toHaveBeenCalledWith('temp');
  });

  it('exports a stable user query key', () => {
    expect(USER_QUERY_KEY).toEqual(['auth', 'user']);
  });
});
