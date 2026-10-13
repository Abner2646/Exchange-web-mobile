'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '@/shared/api';
import { adminApi } from './api';
import type {
  PendingActionsResponse,
  MfaReadiness,
  BusinessConfigResponse,
  ConfigUpsertRequest,
  AmlConfig,
  DenylistAddress,
  DenylistAddRequest,
  AmlCase,
  AdminUser,
  AuditListResponse,
  AuditVerifyResult,
  AuditQueryParams,
} from './types';

// ── Query keys ─────────────────────────────────────────────────────────────────

export const ADMIN_PENDING_KEY = ['admin', 'pending'] as const;
export const ADMIN_READINESS_KEY = ['admin', 'readiness'] as const;
export const ADMIN_CONFIG_KEY = ['admin', 'config'] as const;
export const ADMIN_AML_CONFIG_KEY = ['admin', 'aml-config'] as const;
export const ADMIN_DENYLIST_KEY = ['admin', 'denylist'] as const;
export const ADMIN_CASES_KEY = ['admin', 'cases'] as const;
export const ADMIN_USERS_KEY = ['admin', 'users'] as const;
export const ADMIN_AUDIT_KEY = ['admin', 'audit'] as const;

// ── Queries ────────────────────────────────────────────────────────────────────

export function usePending() {
  return useQuery<PendingActionsResponse, ApiError>({
    queryKey: ADMIN_PENDING_KEY,
    queryFn: () => adminApi.getPending(),
    staleTime: 15_000,
  });
}

export function useReadiness() {
  return useQuery<MfaReadiness, ApiError>({
    queryKey: ADMIN_READINESS_KEY,
    queryFn: () => adminApi.getReadiness(),
    staleTime: 30_000,
  });
}

export function useConfig(category?: string) {
  return useQuery<BusinessConfigResponse, ApiError>({
    queryKey: [...ADMIN_CONFIG_KEY, category],
    queryFn: () => adminApi.getConfig(category),
    staleTime: 60_000,
  });
}

export function useAmlConfig() {
  return useQuery<AmlConfig, ApiError>({
    queryKey: ADMIN_AML_CONFIG_KEY,
    queryFn: () => adminApi.getAmlConfig(),
    staleTime: 30_000,
  });
}

export function useDenylist() {
  return useQuery<DenylistAddress[], ApiError>({
    queryKey: ADMIN_DENYLIST_KEY,
    // NOTE: adminApi.getDenylist is not yet implemented (will be added in a later task);
    // placeholder returns empty array until the backend list endpoint is wired up.
    queryFn: () => Promise.resolve([] as DenylistAddress[]),
    staleTime: 30_000,
  });
}

export function useCases(status?: string) {
  return useQuery<AmlCase[], ApiError>({
    queryKey: [...ADMIN_CASES_KEY, status],
    queryFn: () => adminApi.getCases(status),
    staleTime: 15_000,
  });
}

export function useUsers() {
  return useQuery<AdminUser[], ApiError>({
    queryKey: ADMIN_USERS_KEY,
    queryFn: () => adminApi.listUsers(),
    staleTime: 30_000,
  });
}

export function useAudit(params?: AuditQueryParams) {
  return useQuery<AuditListResponse, ApiError>({
    queryKey: [...ADMIN_AUDIT_KEY, params],
    queryFn: () => adminApi.getAudit(params),
    staleTime: 30_000,
  });
}

/**
 * useAuditVerify — implemented as a mutation (not a query).
 * Rationale: "Verify chain" is a user-triggered one-shot action, not a
 * background data fetch. A mutation fits naturally: the button calls
 * mutateAsync(), gets the result, and the UI shows it inline. Using
 * `enabled: false` + `refetch()` would work but is unnecessarily awkward
 * compared to a mutation that returns data directly.
 */
export function useAuditVerify() {
  return useMutation<AuditVerifyResult, ApiError, void>({
    mutationFn: () => adminApi.verifyAudit(),
    retry: false,
  });
}

// ── Governance mutations ───────────────────────────────────────────────────────

export function useApproveAction() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, { id: string; codigo: string }>({
    mutationFn: ({ id, codigo }) => adminApi.approveAction(id, { codigo }),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_PENDING_KEY });
    },
  });
}

export function useRejectAction() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, { id: string; reason?: string }>({
    mutationFn: ({ id, reason }) => adminApi.rejectAction(id, { reason }),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_PENDING_KEY });
    },
  });
}

// ── Config mutations ───────────────────────────────────────────────────────────

export function useUpsertConfig() {
  const qc = useQueryClient();
  return useMutation<BusinessConfigResponse, ApiError, { key: string; body: ConfigUpsertRequest }>({
    mutationFn: ({ key, body }) => adminApi.upsertConfig(key, body),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_CONFIG_KEY });
    },
  });
}

// ── AML mutations ──────────────────────────────────────────────────────────────

export function useSetAmlConfig() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, { key: string; value: string }>({
    mutationFn: ({ key, value }) => adminApi.setAmlConfig(key, value),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_AML_CONFIG_KEY });
    },
  });
}

export function useAddDenylist() {
  const qc = useQueryClient();
  return useMutation<DenylistAddress, ApiError, DenylistAddRequest>({
    mutationFn: (req) => adminApi.addDenylist(req),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_DENYLIST_KEY });
    },
  });
}

export function useRemoveDenylist() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => adminApi.removeDenylist(id),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_DENYLIST_KEY });
    },
  });
}

export function useResolveCase() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, { id: string; decision: 'approve' | 'reject' }>({
    mutationFn: ({ id, decision }) => adminApi.resolveCase(id, { decision }),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_CASES_KEY });
    },
  });
}

// ── User-admin mutations ───────────────────────────────────────────────────────

export function useUpdateUserStatus() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, { id: string; body?: Record<string, unknown> }>({
    mutationFn: ({ id, body = {} }) => adminApi.updateUserStatus(id, body),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
    },
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, { id: string; body?: Record<string, unknown> }>({
    mutationFn: ({ id, body = {} }) => adminApi.updateUserRole(id, body),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
    },
  });
}

export function useUpdateUserKyc() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, { id: string; body?: Record<string, unknown> }>({
    mutationFn: ({ id, body = {} }) => adminApi.updateUserKyc(id, body),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
    },
  });
}

export function useUpdateUserDailyLimit() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, { id: string; body?: Record<string, unknown> }>({
    mutationFn: ({ id, body = {} }) => adminApi.updateUserDailyLimit(id, body),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
    },
  });
}

export function useUpdateUserReputation() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, { id: string; body?: Record<string, unknown> }>({
    mutationFn: ({ id, body = {} }) => adminApi.updateUserReputation(id, body),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, { id: string }>({
    mutationFn: ({ id }) => adminApi.deleteUser(id),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
    },
  });
}
