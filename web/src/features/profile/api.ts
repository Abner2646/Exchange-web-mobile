import { apiClient } from '@/shared/api';
import type { User } from '@/features/auth/types';
import type {
  ProfileUpdateRequest,
  ChangePasswordRequest,
  EmailChangeRequest,
  EmailChangeConfirmRequest,
  TotpSetupResponse,
  TotpCodeRequest,
  Toggle2FAResponse,
  NotificationsResponse,
  KycStatus,
  ProfileUpdateResponse,
} from './types';

export const profileApi = {
  updateProfile: (req: ProfileUpdateRequest) =>
    apiClient.put<ProfileUpdateResponse>('/user/me', req),

  changePassword: (req: ChangePasswordRequest) =>
    apiClient.patch<{ message: string }>('/user/me/change-password', req),

  requestEmailChange: (req: EmailChangeRequest) =>
    apiClient.post<{ message: string }>('/user/me/email-change', req),

  confirmEmailChange: (req: EmailChangeConfirmRequest) =>
    apiClient.post<{ message: string }>('/user/me/email-change/confirm', req),

  toggle2FA: () =>
    apiClient.patch<Toggle2FAResponse>('/user/me/2fa-toggle'),

  totpSetup: () =>
    apiClient.post<TotpSetupResponse>('/user/me/totp/setup'),

  totpEnable: (req: TotpCodeRequest) =>
    apiClient.post<{ message: string }>('/user/me/totp/enable', req),

  totpDisable: (req: TotpCodeRequest) =>
    apiClient.post<{ message: string }>('/user/me/totp/disable', req),

  requestKyc: () =>
    apiClient.post<{ message: string; user: User }>('/user/me/kyc-request', {}),

  getNotifications: () =>
    apiClient.get<NotificationsResponse>('/notificaciones/me'),

  getUnreadCount: () =>
    apiClient.get<{ count: number } | number>('/notificaciones/me/unread-count'),

  markAllRead: () =>
    apiClient.patch<{ message: string }>('/notificaciones/me/mark-all-read'),

  markRead: (id: string) =>
    apiClient.patch<{ message: string }>(`/notificaciones/me/${id}/mark-read`),

  markUnread: (id: string) =>
    apiClient.patch<{ message: string }>(`/notificaciones/me/${id}/mark-unread`),

  deleteRead: () =>
    apiClient.delete<{ message: string }>('/notificaciones/me/read'),

  getKycStatus: () =>
    apiClient.get<KycStatus>('/kyc/status'),
};
