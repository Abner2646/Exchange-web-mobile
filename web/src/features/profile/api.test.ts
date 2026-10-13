import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/shared/api';
import { profileApi } from './api';

vi.mock('@/shared/api', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
const m = apiClient as unknown as Record<string, ReturnType<typeof vi.fn>>;
beforeEach(() => vi.clearAllMocks());

describe('profileApi', () => {
  it('updateProfile PUTs /user/me with only whitelisted fields', async () => {
    m.put.mockResolvedValue({ user: { id: 'u1' }, token: 't' });
    await profileApi.updateProfile({ displayName: 'Abner', locale: 'es' });
    expect(m.put).toHaveBeenCalledWith('/user/me', { displayName: 'Abner', locale: 'es' });
  });
  it('changePassword PATCHes /user/me/change-password', async () => {
    m.patch.mockResolvedValue({ message: 'ok' });
    await profileApi.changePassword({ currentPassword: 'a', newPassword: 'b' });
    expect(m.patch).toHaveBeenCalledWith('/user/me/change-password', { currentPassword: 'a', newPassword: 'b' });
  });
  it('requestEmailChange POSTs the backend Spanish field names', async () => {
    m.post.mockResolvedValue({ message: 'ok' });
    await profileApi.requestEmailChange({ nuevoEmail: 'n@e.co', passwordActual: 'pw' });
    expect(m.post).toHaveBeenCalledWith('/user/me/email-change', { nuevoEmail: 'n@e.co', passwordActual: 'pw' });
  });
  it('confirmEmailChange POSTs { codigo }', async () => {
    m.post.mockResolvedValue({ message: 'ok' });
    await profileApi.confirmEmailChange({ codigo: '123456' });
    expect(m.post).toHaveBeenCalledWith('/user/me/email-change/confirm', { codigo: '123456' });
  });
  it('toggle2FA PATCHes with no body', async () => {
    m.patch.mockResolvedValue({ message: 'ok', twoFactorEnabled: true });
    await profileApi.toggle2FA();
    expect(m.patch).toHaveBeenCalledWith('/user/me/2fa-toggle');
  });
  it('totp setup/enable/disable hit the right paths', async () => {
    m.post.mockResolvedValue({});
    await profileApi.totpSetup();
    await profileApi.totpEnable({ codigo: '111111' });
    await profileApi.totpDisable({ codigo: '222222' });
    expect(m.post).toHaveBeenNthCalledWith(1, '/user/me/totp/setup');
    expect(m.post).toHaveBeenNthCalledWith(2, '/user/me/totp/enable', { codigo: '111111' });
    expect(m.post).toHaveBeenNthCalledWith(3, '/user/me/totp/disable', { codigo: '222222' });
  });
  it('getNotifications unwraps { notificaciones } and kyc status hits /kyc/status', async () => {
    m.get.mockResolvedValueOnce({ notificaciones: [{ id: 'n1' }], total: 1 });
    const r = await profileApi.getNotifications();
    expect(m.get).toHaveBeenCalledWith('/notificaciones/me');
    expect(r.notificaciones[0].id).toBe('n1');
    m.get.mockResolvedValueOnce({ kycVerified: false, kycLevel: 'none' });
    await profileApi.getKycStatus();
    expect(m.get).toHaveBeenCalledWith('/kyc/status');
  });
});
