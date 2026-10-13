// web/src/features/admin/queries.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ── hoisted mocks ─────────────────────────────────────────────────────────────
const {
  getPending,
  getReadiness,
  approveAction,
  rejectAction,
  getConfig,
  upsertConfig,
  getAmlConfig,
  setAmlConfig,
  getDenylist,
  addDenylist,
  removeDenylist,
  getCases,
  resolveCase,
  listUsers,
  getAudit,
  verifyAudit,
  updateUserStatus,
  updateUserRole,
  updateUserKyc,
  updateUserDailyLimit,
  updateUserReputation,
  deleteUser,
  getUserStats,
} = vi.hoisted(() => ({
  getPending: vi.fn(),
  getReadiness: vi.fn(),
  approveAction: vi.fn(),
  rejectAction: vi.fn(),
  getConfig: vi.fn(),
  upsertConfig: vi.fn(),
  getAmlConfig: vi.fn(),
  setAmlConfig: vi.fn(),
  getDenylist: vi.fn(),
  addDenylist: vi.fn(),
  removeDenylist: vi.fn(),
  getCases: vi.fn(),
  resolveCase: vi.fn(),
  listUsers: vi.fn(),
  getAudit: vi.fn(),
  verifyAudit: vi.fn(),
  updateUserStatus: vi.fn(),
  updateUserRole: vi.fn(),
  updateUserKyc: vi.fn(),
  updateUserDailyLimit: vi.fn(),
  updateUserReputation: vi.fn(),
  deleteUser: vi.fn(),
  getUserStats: vi.fn(),
}));

vi.mock('./api', () => ({
  adminApi: {
    getPending,
    getReadiness,
    approveAction,
    rejectAction,
    getConfig,
    upsertConfig,
    getAmlConfig,
    setAmlConfig,
    getDenylist,
    addDenylist,
    removeDenylist,
    getCases,
    resolveCase,
    listUsers,
    getAudit,
    verifyAudit,
    updateUserStatus,
    updateUserRole,
    updateUserKyc,
    updateUserDailyLimit,
    updateUserReputation,
    deleteUser,
    getUserStats,
  },
}));

vi.mock('@/shared/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
}));

import {
  usePending,
  useReadiness,
  useConfig,
  useAmlConfig,
  useDenylist,
  useCases,
  useUsers,
  useAudit,
  useAuditVerify,
  useApproveAction,
  useRejectAction,
  useUpsertConfig,
  useSetAmlConfig,
  useAddDenylist,
  useRemoveDenylist,
  useResolveCase,
  useUpdateUserStatus,
  useUpdateUserRole,
  useUpdateUserKyc,
  useUpdateUserDailyLimit,
  useUpdateUserReputation,
  useDeleteUser,
  useUserStats,
  ADMIN_PENDING_KEY,
  ADMIN_READINESS_KEY,
  ADMIN_CONFIG_KEY,
  ADMIN_AML_CONFIG_KEY,
  ADMIN_DENYLIST_KEY,
  ADMIN_CASES_KEY,
  ADMIN_USERS_KEY,
  ADMIN_AUDIT_KEY,
  ADMIN_USER_STATS_KEY,
} from './queries';

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

// ── Key shape tests ────────────────────────────────────────────────────────────

describe('exported query keys', () => {
  it('ADMIN_PENDING_KEY is correct', () => {
    expect(ADMIN_PENDING_KEY).toEqual(['admin', 'pending']);
  });
  it('ADMIN_READINESS_KEY is correct', () => {
    expect(ADMIN_READINESS_KEY).toEqual(['admin', 'readiness']);
  });
  it('ADMIN_CONFIG_KEY is correct', () => {
    expect(ADMIN_CONFIG_KEY).toEqual(['admin', 'config']);
  });
  it('ADMIN_AML_CONFIG_KEY is correct', () => {
    expect(ADMIN_AML_CONFIG_KEY).toEqual(['admin', 'aml-config']);
  });
  it('ADMIN_DENYLIST_KEY is correct', () => {
    expect(ADMIN_DENYLIST_KEY).toEqual(['admin', 'denylist']);
  });
  it('ADMIN_CASES_KEY is correct', () => {
    expect(ADMIN_CASES_KEY).toEqual(['admin', 'cases']);
  });
  it('ADMIN_USERS_KEY is correct', () => {
    expect(ADMIN_USERS_KEY).toEqual(['admin', 'users']);
  });
  it('ADMIN_AUDIT_KEY is correct', () => {
    expect(ADMIN_AUDIT_KEY).toEqual(['admin', 'audit']);
  });
  it('ADMIN_USER_STATS_KEY is correct', () => {
    expect(ADMIN_USER_STATS_KEY).toEqual(['admin', 'userStats']);
  });
});

// ── Query tests ────────────────────────────────────────────────────────────────

describe('admin queries', () => {
  it('usePending fetches via adminApi.getPending', async () => {
    const payload = { pending: [{ id: 'a1', actionType: 'WITHDRAWAL', payload: {}, amountUsd: '100', status: 'pending', makerUserId: 'u1', checkerUserId: null, rejectionReason: null, result: null, expiresAt: '', resolvedAt: null, created_at: '' }] };
    getPending.mockResolvedValueOnce(payload);
    const qc = makeQC();
    const { result } = renderHook(() => usePending(), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getPending).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(payload);
  });

  it('useReadiness fetches via adminApi.getReadiness', async () => {
    getReadiness.mockResolvedValueOnce({ ready: true, operatorCount: 2, enrolledCount: 2, minEnrolled: 1, enrolled: [], pending: [], reasons: [] });
    const qc = makeQC();
    const { result } = renderHook(() => useReadiness(), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getReadiness).toHaveBeenCalledTimes(1);
  });

  it('useConfig fetches via adminApi.getConfig without category', async () => {
    getConfig.mockResolvedValueOnce({ data: [] });
    const qc = makeQC();
    const { result } = renderHook(() => useConfig(), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getConfig).toHaveBeenCalledWith(undefined);
  });

  it('useConfig passes category to adminApi.getConfig', async () => {
    getConfig.mockResolvedValueOnce({ data: [] });
    const qc = makeQC();
    const { result } = renderHook(() => useConfig('trading'), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getConfig).toHaveBeenCalledWith('trading');
  });

  it('useAmlConfig fetches via adminApi.getAmlConfig', async () => {
    getAmlConfig.mockResolvedValueOnce({ monitoringEnabled: true, holdEnforcementEnabled: false });
    const qc = makeQC();
    const { result } = renderHook(() => useAmlConfig(), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getAmlConfig).toHaveBeenCalledTimes(1);
  });

  it('useDenylist fetches via adminApi.getDenylist and surfaces data', async () => {
    const rows = [
      { id: 'd1', address: '0xabc', network: 'ETH', addedBy: 'u1', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'd2', address: '0xdef', network: 'BTC', addedBy: 'u2', createdAt: '2026-01-02T00:00:00.000Z' },
    ];
    getDenylist.mockResolvedValueOnce(rows);
    const qc = makeQC();
    const { result } = renderHook(() => useDenylist(), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getDenylist).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(rows);
  });

  it('useCases fetches via adminApi.getCases', async () => {
    getCases.mockResolvedValueOnce([{ id: 'c1', status: 'open' }]);
    const qc = makeQC();
    const { result } = renderHook(() => useCases(), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCases).toHaveBeenCalledWith(undefined);
  });

  it('useCases passes status filter', async () => {
    getCases.mockResolvedValueOnce([]);
    const qc = makeQC();
    const { result } = renderHook(() => useCases('open'), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCases).toHaveBeenCalledWith('open');
  });

  it('useUsers fetches via adminApi.listUsers', async () => {
    listUsers.mockResolvedValueOnce([{ id: 'u1', username: 'alice', email: 'a@b.com', role: 'user', active: true }]);
    const qc = makeQC();
    const { result } = renderHook(() => useUsers(), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listUsers).toHaveBeenCalledTimes(1);
  });

  it('useAudit fetches via adminApi.getAudit with params', async () => {
    getAudit.mockResolvedValueOnce({ rows: [], nextBeforeId: null });
    const qc = makeQC();
    const params = { eventType: 'SWAP', limit: 10 };
    const { result } = renderHook(() => useAudit(params), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getAudit).toHaveBeenCalledWith(params);
  });

  it('useUserStats fetches via adminApi.getUserStats', async () => {
    getUserStats.mockResolvedValueOnce({ totalUsers: 42, activeUsers: 38 });
    const qc = makeQC();
    const { result } = renderHook(() => useUserStats(), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getUserStats).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({ totalUsers: 42, activeUsers: 38 });
  });
});

// ── useAuditVerify (mutation) ──────────────────────────────────────────────────

describe('useAuditVerify', () => {
  it('calls adminApi.verifyAudit when mutated', async () => {
    verifyAudit.mockResolvedValueOnce({ ok: true, brokenAtSeq: null, checked: 50 });
    const qc = makeQC();
    const { result } = renderHook(() => useAuditVerify(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync(undefined);
    });
    expect(verifyAudit).toHaveBeenCalledTimes(1);
  });
});

// ── Mutation tests ─────────────────────────────────────────────────────────────

describe('useApproveAction', () => {
  it('calls adminApi.approveAction(id, {codigo}) with correct args', async () => {
    approveAction.mockResolvedValueOnce(undefined);
    const qc = makeQC();
    const { result } = renderHook(() => useApproveAction(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ id: 'act1', codigo: '123456' });
    });
    expect(approveAction).toHaveBeenCalledWith('act1', { codigo: '123456' });
  });

  it('invalidates ADMIN_PENDING_KEY on success', async () => {
    approveAction.mockResolvedValueOnce(undefined);
    const qc = makeQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useApproveAction(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ id: 'act1', codigo: '111111' });
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ADMIN_PENDING_KEY });
  });
});

describe('useRejectAction', () => {
  it('calls adminApi.rejectAction(id, {reason}) with correct args', async () => {
    rejectAction.mockResolvedValueOnce(undefined);
    const qc = makeQC();
    const { result } = renderHook(() => useRejectAction(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ id: 'act2', reason: 'fraud' });
    });
    expect(rejectAction).toHaveBeenCalledWith('act2', { reason: 'fraud' });
  });

  it('invalidates ADMIN_PENDING_KEY on success', async () => {
    rejectAction.mockResolvedValueOnce(undefined);
    const qc = makeQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useRejectAction(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ id: 'act2' });
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ADMIN_PENDING_KEY });
  });
});

describe('useUpsertConfig', () => {
  it('calls adminApi.upsertConfig with {key, body}', async () => {
    upsertConfig.mockResolvedValueOnce({ data: [] });
    const qc = makeQC();
    const { result } = renderHook(() => useUpsertConfig(), { wrapper: wrapper(qc) });
    const body = { value: '100', type: 'number' as const };
    await act(async () => {
      await result.current.mutateAsync({ key: 'MAX_WITHDRAWAL', body });
    });
    expect(upsertConfig).toHaveBeenCalledWith('MAX_WITHDRAWAL', body);
  });

  it('invalidates ADMIN_CONFIG_KEY on success', async () => {
    upsertConfig.mockResolvedValueOnce({ data: [] });
    const qc = makeQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpsertConfig(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ key: 'K', body: { value: 'v' } });
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ADMIN_CONFIG_KEY });
  });
});

describe('useSetAmlConfig', () => {
  it('calls adminApi.setAmlConfig(key, value)', async () => {
    setAmlConfig.mockResolvedValueOnce(undefined);
    const qc = makeQC();
    const { result } = renderHook(() => useSetAmlConfig(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ key: 'monitoringEnabled', value: 'true' });
    });
    expect(setAmlConfig).toHaveBeenCalledWith('monitoringEnabled', 'true');
  });

  it('invalidates ADMIN_AML_CONFIG_KEY on success', async () => {
    setAmlConfig.mockResolvedValueOnce(undefined);
    const qc = makeQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useSetAmlConfig(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ key: 'monitoringEnabled', value: 'false' });
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ADMIN_AML_CONFIG_KEY });
  });
});

describe('useAddDenylist', () => {
  it('calls adminApi.addDenylist with DenylistAddRequest', async () => {
    addDenylist.mockResolvedValueOnce({ id: 'd1', address: '0xabc', network: 'ETH' });
    const qc = makeQC();
    const { result } = renderHook(() => useAddDenylist(), { wrapper: wrapper(qc) });
    const req = { address: '0xabc', network: 'ETH', reason: 'suspicious' };
    await act(async () => {
      await result.current.mutateAsync(req);
    });
    expect(addDenylist).toHaveBeenCalledWith(req);
  });

  it('invalidates ADMIN_DENYLIST_KEY on success', async () => {
    addDenylist.mockResolvedValueOnce({ id: 'd1', address: '0xabc', network: 'ETH' });
    const qc = makeQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useAddDenylist(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ address: '0xabc', network: 'ETH' });
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ADMIN_DENYLIST_KEY });
  });
});

describe('useRemoveDenylist', () => {
  it('calls adminApi.removeDenylist(id)', async () => {
    removeDenylist.mockResolvedValueOnce(undefined);
    const qc = makeQC();
    const { result } = renderHook(() => useRemoveDenylist(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync('d1');
    });
    expect(removeDenylist).toHaveBeenCalledWith('d1');
  });

  it('invalidates ADMIN_DENYLIST_KEY on success', async () => {
    removeDenylist.mockResolvedValueOnce(undefined);
    const qc = makeQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useRemoveDenylist(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync('d2');
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ADMIN_DENYLIST_KEY });
  });
});

describe('useResolveCase', () => {
  it('calls adminApi.resolveCase(id, {decision})', async () => {
    resolveCase.mockResolvedValueOnce(undefined);
    const qc = makeQC();
    const { result } = renderHook(() => useResolveCase(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ id: 'c1', decision: 'approve' });
    });
    expect(resolveCase).toHaveBeenCalledWith('c1', { decision: 'approve' });
  });

  it('invalidates ADMIN_CASES_KEY on success', async () => {
    resolveCase.mockResolvedValueOnce(undefined);
    const qc = makeQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useResolveCase(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ id: 'c1', decision: 'reject' });
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ADMIN_CASES_KEY });
  });
});

describe('user-admin mutations', () => {
  it('useUpdateUserStatus invalidates ADMIN_USERS_KEY on success', async () => {
    updateUserStatus.mockResolvedValueOnce(undefined);
    const qc = makeQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateUserStatus(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ id: 'u1', body: { active: false } });
    });
    expect(updateUserStatus).toHaveBeenCalledWith('u1', { active: false });
    expect(spy).toHaveBeenCalledWith({ queryKey: ADMIN_USERS_KEY });
  });

  it('useUpdateUserRole invalidates ADMIN_USERS_KEY on success', async () => {
    updateUserRole.mockResolvedValueOnce(undefined);
    const qc = makeQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateUserRole(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ id: 'u1', body: { role: 'admin' } });
    });
    expect(updateUserRole).toHaveBeenCalledWith('u1', { role: 'admin' });
    expect(spy).toHaveBeenCalledWith({ queryKey: ADMIN_USERS_KEY });
  });

  it('useUpdateUserKyc invalidates ADMIN_USERS_KEY on success', async () => {
    updateUserKyc.mockResolvedValueOnce(undefined);
    const qc = makeQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateUserKyc(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ id: 'u1', body: { verified: true } });
    });
    expect(updateUserKyc).toHaveBeenCalledWith('u1', { verified: true });
    expect(spy).toHaveBeenCalledWith({ queryKey: ADMIN_USERS_KEY });
  });

  it('useUpdateUserDailyLimit invalidates ADMIN_USERS_KEY on success', async () => {
    updateUserDailyLimit.mockResolvedValueOnce(undefined);
    const qc = makeQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateUserDailyLimit(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ id: 'u1', body: { dailyLimitUsd: '5000' } });
    });
    expect(updateUserDailyLimit).toHaveBeenCalledWith('u1', { dailyLimitUsd: '5000' });
    expect(spy).toHaveBeenCalledWith({ queryKey: ADMIN_USERS_KEY });
  });

  it('useUpdateUserReputation invalidates ADMIN_USERS_KEY on success', async () => {
    updateUserReputation.mockResolvedValueOnce(undefined);
    const qc = makeQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateUserReputation(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ id: 'u1', body: { averageRating: 90 } });
    });
    expect(updateUserReputation).toHaveBeenCalledWith('u1', { averageRating: 90 });
    expect(spy).toHaveBeenCalledWith({ queryKey: ADMIN_USERS_KEY });
  });

  it('useDeleteUser calls adminApi.deleteUser(id) and invalidates ADMIN_USERS_KEY', async () => {
    deleteUser.mockResolvedValueOnce(undefined);
    const qc = makeQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteUser(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ id: 'u1' });
    });
    expect(deleteUser).toHaveBeenCalledWith('u1');
    expect(spy).toHaveBeenCalledWith({ queryKey: ADMIN_USERS_KEY });
  });
});
