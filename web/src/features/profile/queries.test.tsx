// web/src/features/profile/queries.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ── hoisted mocks ─────────────────────────────────────────────────────────────
const {
  updateProfile,
  changePassword,
  requestEmailChange,
  confirmEmailChange,
  toggle2FA,
  totpSetup,
  totpEnable,
  totpDisable,
  requestKyc,
  getNotifications,
  getUnreadCount,
  getKycStatus,
  markAllRead,
  markRead,
  markUnread,
  deleteRead,
  setToken,
} = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  requestEmailChange: vi.fn(),
  confirmEmailChange: vi.fn(),
  toggle2FA: vi.fn(),
  totpSetup: vi.fn(),
  totpEnable: vi.fn(),
  totpDisable: vi.fn(),
  requestKyc: vi.fn(),
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  getKycStatus: vi.fn(),
  markAllRead: vi.fn(),
  markRead: vi.fn(),
  markUnread: vi.fn(),
  deleteRead: vi.fn(),
  setToken: vi.fn(),
}));

vi.mock('./api', () => ({
  profileApi: {
    updateProfile,
    changePassword,
    requestEmailChange,
    confirmEmailChange,
    toggle2FA,
    totpSetup,
    totpEnable,
    totpDisable,
    requestKyc,
    getNotifications,
    getUnreadCount,
    getKycStatus,
    markAllRead,
    markRead,
    markUnread,
    deleteRead,
  },
}));

vi.mock('@/shared/api', () => ({
  session: { setToken },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
}));

import {
  useNotifications,
  useUnreadCount,
  useKycStatus,
  useUpdateProfile,
  useChangePassword,
  useRequestEmailChange,
  useConfirmEmailChange,
  useToggle2FA,
  useTotpSetup,
  useTotpEnable,
  useTotpDisable,
  useRequestKyc,
  useMarkAllRead,
  useMarkRead,
  useMarkUnread,
  useDeleteRead,
  PROFILE_NOTIFICATIONS_KEY,
  PROFILE_UNREAD_KEY,
  PROFILE_KYC_KEY,
} from './queries';

import { USER_QUERY_KEY } from '@/features/auth/queries';

function wrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Query tests ────────────────────────────────────────────────────────────────

describe('profile queries', () => {
  it('useNotifications fetches via profileApi.getNotifications', async () => {
    const payload = { notificaciones: [{ id: 'n1', type: 'system', title: 'T', message: 'M', read: false, important: false }] };
    getNotifications.mockResolvedValueOnce(payload);
    const qc = makeQC();
    const { result } = renderHook(() => useNotifications(), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getNotifications).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(payload);
  });

  it('useUnreadCount fetches via profileApi.getUnreadCount', async () => {
    getUnreadCount.mockResolvedValueOnce({ count: 3 });
    const qc = makeQC();
    const { result } = renderHook(() => useUnreadCount(), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getUnreadCount).toHaveBeenCalledTimes(1);
  });

  it('useKycStatus fetches via profileApi.getKycStatus', async () => {
    getKycStatus.mockResolvedValueOnce({ kycVerified: false, kycLevel: 'none' });
    const qc = makeQC();
    const { result } = renderHook(() => useKycStatus(), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getKycStatus).toHaveBeenCalledTimes(1);
  });
});

// ── Mutation tests ─────────────────────────────────────────────────────────────

describe('useUpdateProfile', () => {
  it('calls profileApi.updateProfile with correct args', async () => {
    updateProfile.mockResolvedValueOnce({ user: { id: 'u1' } });
    const qc = makeQC();
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ displayName: 'Alice' });
    });
    expect(updateProfile).toHaveBeenCalledWith({ displayName: 'Alice' });
  });

  it('calls session.setToken when a token is returned', async () => {
    updateProfile.mockResolvedValueOnce({ user: { id: 'u1' }, token: 'new-jwt' });
    const qc = makeQC();
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ displayName: 'Bob' });
    });
    expect(setToken).toHaveBeenCalledWith('new-jwt');
  });

  it('does NOT call session.setToken when no token is returned', async () => {
    updateProfile.mockResolvedValueOnce({ user: { id: 'u1' } });
    const qc = makeQC();
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ displayName: 'Carol' });
    });
    expect(setToken).not.toHaveBeenCalled();
  });

  it('invalidates USER_QUERY_KEY on success', async () => {
    updateProfile.mockResolvedValueOnce({ user: { id: 'u1' } });
    const qc = makeQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ displayName: 'Dave' });
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: USER_QUERY_KEY });
  });
});

describe('useToggle2FA', () => {
  it('calls profileApi.toggle2FA with no args', async () => {
    toggle2FA.mockResolvedValueOnce({ message: 'ok', twoFactorEnabled: true });
    const qc = makeQC();
    const { result } = renderHook(() => useToggle2FA(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync(undefined);
    });
    expect(toggle2FA).toHaveBeenCalledWith();
  });

  it('invalidates USER_QUERY_KEY on success', async () => {
    toggle2FA.mockResolvedValueOnce({ message: 'ok', twoFactorEnabled: false });
    const qc = makeQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useToggle2FA(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync(undefined);
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: USER_QUERY_KEY });
  });
});

describe('useConfirmEmailChange', () => {
  it('invalidates USER_QUERY_KEY on success', async () => {
    confirmEmailChange.mockResolvedValueOnce({ message: 'ok' });
    const qc = makeQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useConfirmEmailChange(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ codigo: '123456' });
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: USER_QUERY_KEY });
  });
});

describe('useTotpEnable', () => {
  it('invalidates USER_QUERY_KEY on success', async () => {
    totpEnable.mockResolvedValueOnce({ message: 'ok' });
    const qc = makeQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useTotpEnable(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ codigo: '111111' });
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: USER_QUERY_KEY });
  });
});

describe('useTotpDisable', () => {
  it('invalidates USER_QUERY_KEY on success', async () => {
    totpDisable.mockResolvedValueOnce({ message: 'ok' });
    const qc = makeQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useTotpDisable(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ codigo: '222222' });
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: USER_QUERY_KEY });
  });
});

describe('useRequestKyc', () => {
  it('invalidates USER_QUERY_KEY and PROFILE_KYC_KEY on success', async () => {
    requestKyc.mockResolvedValueOnce({ message: 'ok', user: { id: 'u1' } });
    const qc = makeQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useRequestKyc(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync(undefined);
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: USER_QUERY_KEY });
    expect(spy).toHaveBeenCalledWith({ queryKey: PROFILE_KYC_KEY });
  });
});

describe('notification mutations', () => {
  it('useMarkAllRead invalidates notifications + unread keys', async () => {
    markAllRead.mockResolvedValueOnce({ message: 'ok' });
    const qc = makeQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useMarkAllRead(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync(undefined);
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: PROFILE_NOTIFICATIONS_KEY });
    expect(spy).toHaveBeenCalledWith({ queryKey: PROFILE_UNREAD_KEY });
  });

  it('useMarkRead calls profileApi.markRead with the id', async () => {
    markRead.mockResolvedValueOnce({ message: 'ok' });
    const qc = makeQC();
    const { result } = renderHook(() => useMarkRead(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync('n42');
    });
    expect(markRead).toHaveBeenCalledWith('n42');
  });

  it('useMarkUnread invalidates notifications + unread keys', async () => {
    markUnread.mockResolvedValueOnce({ message: 'ok' });
    const qc = makeQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useMarkUnread(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync('n7');
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: PROFILE_NOTIFICATIONS_KEY });
    expect(spy).toHaveBeenCalledWith({ queryKey: PROFILE_UNREAD_KEY });
  });

  it('useDeleteRead invalidates notifications + unread keys', async () => {
    deleteRead.mockResolvedValueOnce({ message: 'ok' });
    const qc = makeQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteRead(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync(undefined);
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: PROFILE_NOTIFICATIONS_KEY });
    expect(spy).toHaveBeenCalledWith({ queryKey: PROFILE_UNREAD_KEY });
  });
});

describe('exported keys', () => {
  it('PROFILE_NOTIFICATIONS_KEY is correct', () => {
    expect(PROFILE_NOTIFICATIONS_KEY).toEqual(['profile', 'notifications']);
  });
  it('PROFILE_UNREAD_KEY is correct', () => {
    expect(PROFILE_UNREAD_KEY).toEqual(['profile', 'unread']);
  });
  it('PROFILE_KYC_KEY is correct', () => {
    expect(PROFILE_KYC_KEY).toEqual(['profile', 'kyc']);
  });
});
