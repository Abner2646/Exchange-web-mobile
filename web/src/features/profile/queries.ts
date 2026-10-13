'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '@/shared/api';
import { session } from '@/shared/api';
import { profileApi } from './api';
import { USER_QUERY_KEY } from '@/features/auth/queries';
import type {
  ProfileUpdateRequest,
  ProfileUpdateResponse,
  ChangePasswordRequest,
  EmailChangeRequest,
  EmailChangeConfirmRequest,
  TotpSetupResponse,
  TotpCodeRequest,
  Toggle2FAResponse,
  NotificationsResponse,
  KycStatus,
} from './types';
import type { User } from '@/features/auth/types';

// ── Query keys ─────────────────────────────────────────────────────────────────

export const PROFILE_NOTIFICATIONS_KEY = ['profile', 'notifications'] as const;
export const PROFILE_UNREAD_KEY = ['profile', 'unread'] as const;
export const PROFILE_KYC_KEY = ['profile', 'kyc'] as const;

// ── Queries ────────────────────────────────────────────────────────────────────

export function useNotifications() {
  return useQuery<NotificationsResponse, ApiError>({
    queryKey: PROFILE_NOTIFICATIONS_KEY,
    queryFn: () => profileApi.getNotifications(),
    staleTime: 30_000,
  });
}

export function useUnreadCount() {
  return useQuery<{ count: number } | number, ApiError>({
    queryKey: PROFILE_UNREAD_KEY,
    queryFn: () => profileApi.getUnreadCount(),
    staleTime: 15_000,
  });
}

export function useKycStatus() {
  return useQuery<KycStatus, ApiError>({
    queryKey: PROFILE_KYC_KEY,
    queryFn: () => profileApi.getKycStatus(),
    staleTime: 60_000,
  });
}

// ── Profile mutations ──────────────────────────────────────────────────────────

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation<ProfileUpdateResponse, ApiError, ProfileUpdateRequest>({
    mutationFn: (req) => profileApi.updateProfile(req),
    retry: false,
    onSuccess: (res) => {
      if (res.token) session.setToken(res.token);
      qc.invalidateQueries({ queryKey: USER_QUERY_KEY });
    },
  });
}

export function useChangePassword() {
  return useMutation<{ message: string }, ApiError, ChangePasswordRequest>({
    mutationFn: (req) => profileApi.changePassword(req),
    retry: false,
  });
}

export function useRequestEmailChange() {
  return useMutation<{ message: string }, ApiError, EmailChangeRequest>({
    mutationFn: (req) => profileApi.requestEmailChange(req),
    retry: false,
  });
}

export function useConfirmEmailChange() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, ApiError, EmailChangeConfirmRequest>({
    mutationFn: (req) => profileApi.confirmEmailChange(req),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USER_QUERY_KEY });
    },
  });
}

export function useToggle2FA() {
  const qc = useQueryClient();
  return useMutation<Toggle2FAResponse, ApiError, void>({
    mutationFn: () => profileApi.toggle2FA(),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USER_QUERY_KEY });
    },
  });
}

export function useTotpSetup() {
  return useMutation<TotpSetupResponse, ApiError, void>({
    mutationFn: () => profileApi.totpSetup(),
    retry: false,
  });
}

export function useTotpEnable() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, ApiError, TotpCodeRequest>({
    mutationFn: (req) => profileApi.totpEnable(req),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USER_QUERY_KEY });
    },
  });
}

export function useTotpDisable() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, ApiError, TotpCodeRequest>({
    mutationFn: (req) => profileApi.totpDisable(req),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USER_QUERY_KEY });
    },
  });
}

export function useRequestKyc() {
  const qc = useQueryClient();
  return useMutation<{ message: string; user: User }, ApiError, void>({
    mutationFn: () => profileApi.requestKyc(),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USER_QUERY_KEY });
      qc.invalidateQueries({ queryKey: PROFILE_KYC_KEY });
    },
  });
}

// ── Notification mutations ─────────────────────────────────────────────────────

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, ApiError, void>({
    mutationFn: () => profileApi.markAllRead(),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROFILE_NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: PROFILE_UNREAD_KEY });
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: (id) => profileApi.markRead(id),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROFILE_NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: PROFILE_UNREAD_KEY });
    },
  });
}

export function useMarkUnread() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: (id) => profileApi.markUnread(id),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROFILE_NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: PROFILE_UNREAD_KEY });
    },
  });
}

export function useDeleteRead() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, ApiError, void>({
    mutationFn: () => profileApi.deleteRead(),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROFILE_NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: PROFILE_UNREAD_KEY });
    },
  });
}
