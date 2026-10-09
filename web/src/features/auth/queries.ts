'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { session, ApiError } from '@/shared/api';
import { authApi } from './api';
import { isTwoFactorChallenge } from './types';
import type {
  RegisterRequest, RegisterResponse,
  VerifyEmailRequest, VerifyEmailResponse,
  LoginRequest, LoginResult,
  Verify2FARequest, Resend2FARequest,
  ForgotPasswordRequest, VerifyResetCodeRequest, ResetPasswordRequest,
  GoogleLoginRequest, AuthSession, User,
} from './types';

export const USER_QUERY_KEY = ['auth', 'user'] as const;

export function useCurrentUser() {
  return useQuery<User | null>({
    queryKey: USER_QUERY_KEY,
    queryFn: () => authApi.me(),
    enabled: session.hasToken(),
    staleTime: 60_000,
    retry: false,
  });
}

export function useRegister() {
  return useMutation<RegisterResponse, ApiError, RegisterRequest>({
    mutationFn: authApi.register,
    onSuccess: (data) => { session.setToken(data.token); },
  });
}

export function useVerifyEmail() {
  const qc = useQueryClient();
  return useMutation<VerifyEmailResponse, ApiError, VerifyEmailRequest>({
    mutationFn: authApi.verifyEmail,
    onSuccess: (data) => {
      session.setToken(data.token);
      qc.setQueryData(USER_QUERY_KEY, data.user);
    },
  });
}

export function useResendVerification() {
  return useMutation<{ message: string }, ApiError, void>({
    mutationFn: () => authApi.resendVerification(),
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation<LoginResult, ApiError, LoginRequest>({
    mutationFn: authApi.login,
    onSuccess: (result) => {
      if (isTwoFactorChallenge(result)) return; // form drives the 2FA step
      session.setToken(result.token);
      qc.setQueryData(USER_QUERY_KEY, result.user);
    },
  });
}

export function useVerify2FA() {
  const qc = useQueryClient();
  return useMutation<AuthSession, ApiError, Verify2FARequest>({
    mutationFn: authApi.verify2FA,
    onSuccess: (data) => {
      session.setToken(data.token);
      qc.setQueryData(USER_QUERY_KEY, data.user);
    },
  });
}

export function useResend2FA() {
  return useMutation<{ message: string }, ApiError, Resend2FARequest>({
    mutationFn: authApi.resend2FA,
  });
}

export function useForgotPassword() {
  return useMutation<{ message: string }, ApiError, ForgotPasswordRequest>({
    mutationFn: authApi.forgotPassword,
  });
}

export function useVerifyResetCode() {
  return useMutation<{ message?: string }, ApiError, VerifyResetCodeRequest>({
    mutationFn: authApi.verifyResetCode,
  });
}

export function useResetPassword() {
  const qc = useQueryClient();
  return useMutation<AuthSession, ApiError, ResetPasswordRequest>({
    mutationFn: authApi.resetPassword,
    onSuccess: (data) => {
      session.setToken(data.token);
      qc.setQueryData(USER_QUERY_KEY, data.user);
    },
  });
}

export function useGoogleLogin() {
  const qc = useQueryClient();
  return useMutation<AuthSession, ApiError, GoogleLoginRequest>({
    mutationFn: authApi.loginWithGoogle,
    onSuccess: (data) => {
      session.setToken(data.token);
      qc.setQueryData(USER_QUERY_KEY, data.user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return () => {
    session.clearToken();
    qc.setQueryData(USER_QUERY_KEY, null);
  };
}
