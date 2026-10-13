import type { User } from '@/features/auth/types';

export type ProfileUpdateRequest = {
  displayName?: string;
  country?: string;
  state?: string;
  locale?: string;
};

export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

export type EmailChangeRequest = {
  nuevoEmail: string;
  passwordActual: string;
};

export type EmailChangeConfirmRequest = {
  codigo: string;
};

export type TotpSetupResponse = {
  otpauthUri: string;
  secret: string;
  qr: string;
};

export type TotpCodeRequest = {
  codigo: string;
};

export type Toggle2FAResponse = {
  message: string;
  twoFactorEnabled: boolean;
};

export type NotificationType = 'security' | 'transaction' | 'kyc' | 'system' | 'p2p' | 'exchange';

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  important: boolean;
  created_at?: string;
  sentAt?: string;
};

export type NotificationsResponse = {
  notificaciones: AppNotification[];
  total?: number;
  page?: number;
  limit?: number;
};

export type KycStatus = {
  kycVerified: boolean;
  kycLevel: 'none' | 'basic' | 'full';
};

export type ProfileUpdateResponse = {
  user: User;
  token?: string;
};
