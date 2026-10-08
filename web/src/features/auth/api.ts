import { apiClient } from '@/shared/api';
import type {
  RegisterRequest, RegisterResponse,
  VerifyEmailRequest, VerifyEmailResponse,
  LoginRequest, LoginResult,
  Verify2FARequest, Resend2FARequest,
  ForgotPasswordRequest, VerifyResetCodeRequest, ResetPasswordRequest,
  GoogleLoginRequest, AuthSession, User,
} from './types';

export const authApi = {
  register: (data: RegisterRequest) =>
    apiClient.post<RegisterResponse>('/user/register', data),

  verifyEmail: (data: VerifyEmailRequest) =>
    apiClient.post<VerifyEmailResponse>('/user/verify-email', data),

  resendVerification: () =>
    apiClient.post<{ message: string }>('/user/resend-verification-email', {}),

  login: (data: LoginRequest) =>
    apiClient.post<LoginResult>('/user/login', data),

  verify2FA: (data: Verify2FARequest) =>
    apiClient.post<AuthSession>('/user/verify-2fa', data),

  resend2FA: (data: Resend2FARequest) =>
    apiClient.post<{ message: string }>('/user/resend-2fa', data),

  forgotPassword: (data: ForgotPasswordRequest) =>
    apiClient.post<{ message: string }>('/user/forgot-password', data),

  verifyResetCode: (data: VerifyResetCodeRequest) =>
    apiClient.post<{ message?: string }>('/user/verify-reset-code', data),

  resetPassword: (data: ResetPasswordRequest) =>
    apiClient.post<AuthSession>('/user/reset-password', data),

  loginWithGoogle: (data: GoogleLoginRequest) =>
    apiClient.post<AuthSession>('/user/login/google', data),

  me: () => apiClient.get<User>('/user/me'),
};
