import { useMutation, useQuery, useQueryClient } from 'react-query';
import { authApi, LoginRequest, RegisterRequest, VerifyEmailRequest, User, LoginResponse, RegisterResponse, VerifyEmailResponse } from './api';
import { session, ApiError } from '../../shared/api';

const USER_QUERY_KEY = ['user'];

export const useUser = () => {
  return useQuery<User | null>(USER_QUERY_KEY, () => null, {
    staleTime: Infinity,
    cacheTime: Infinity,
    initialData: null,
  });
};

export const useRegister = () => {
  return useMutation<RegisterResponse, ApiError, RegisterRequest>(authApi.register);
};

export const useLogin = () => {
  const queryClient = useQueryClient();
  return useMutation<LoginResponse, ApiError, LoginRequest>(authApi.login, {
    onSuccess: (data) => {
      session.setToken(data.token);
      queryClient.setQueryData(USER_QUERY_KEY, data.user);
    },
  });
};

export const useVerifyEmail = () => {
  return useMutation<VerifyEmailResponse, ApiError, VerifyEmailRequest>(authApi.verifyEmail, {
    // If verify returns a token, update session (sometimes it does)
    onSuccess: (data) => {
      if (data.token) {
        session.setToken(data.token);
      }
    }
  });
};

export const useResendVerification = () => {
  return useMutation<{ message: string }, ApiError, void>(authApi.resendVerification);
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  return () => {
    session.clearToken();
    queryClient.setQueryData(USER_QUERY_KEY, null);
  };
};
