import { describe, it, expect, vi, beforeEach } from 'vitest';

const post = vi.fn();
const get = vi.fn();
vi.mock('@/shared/api', () => ({ apiClient: { post: (...a: unknown[]) => post(...a), get: (...a: unknown[]) => get(...a) } }));

import { authApi } from './api';

beforeEach(() => { post.mockReset(); get.mockReset(); post.mockResolvedValue({}); get.mockResolvedValue({}); });

describe('authApi', () => {
  it('register posts credentials to /user/register', async () => {
    await authApi.register({ email: 'a@b.co', password: 'pw', username: 'u' });
    expect(post).toHaveBeenCalledWith('/user/register', { email: 'a@b.co', password: 'pw', username: 'u' });
  });

  it('verifyEmail posts the code as `codigo` (backend contract)', async () => {
    await authApi.verifyEmail({ codigo: '123456' });
    expect(post).toHaveBeenCalledWith('/user/verify-email', { codigo: '123456' });
  });

  it('login posts email+password to /user/login', async () => {
    await authApi.login({ email: 'a@b.co', password: 'pw' });
    expect(post).toHaveBeenCalledWith('/user/login', { email: 'a@b.co', password: 'pw' });
  });

  it('verify2FA posts temporalToken + codigo', async () => {
    await authApi.verify2FA({ temporalToken: 'tt', codigo: '999' });
    expect(post).toHaveBeenCalledWith('/user/verify-2fa', { temporalToken: 'tt', codigo: '999' });
  });

  it('resetPassword posts email, codigo and both passwords', async () => {
    await authApi.resetPassword({ email: 'a@b.co', codigo: '1', newPassword: 'x', confirmPassword: 'x' });
    expect(post).toHaveBeenCalledWith('/user/reset-password', { email: 'a@b.co', codigo: '1', newPassword: 'x', confirmPassword: 'x' });
  });

  it('loginWithGoogle posts idToken', async () => {
    await authApi.loginWithGoogle({ idToken: 'g' });
    expect(post).toHaveBeenCalledWith('/user/login/google', { idToken: 'g' });
  });

  it('me GETs /user/me', async () => {
    await authApi.me();
    expect(get).toHaveBeenCalledWith('/user/me');
  });
});
