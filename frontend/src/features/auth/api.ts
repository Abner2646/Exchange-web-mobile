import { apiClient } from '../../shared/api';

export interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  active: boolean;
  role: string;
  country?: string;
  state?: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  kycVerified: boolean;
  kycLevel: 'none' | 'basic' | 'full';
  dateOfBirth?: string;
  legalName?: string;
}

export interface LoginResponse {
  message: string;
  user: User;
  token: string;
  isNew: boolean;
}

export interface RegisterRequest {
  email: string;
  password?: string; // made optional because some might login with google, but here register typically has password
  username: string;
  displayName?: string;
}

export interface RegisterResponse {
  message: string;
  user: User;
  token?: string;
}

export interface VerifyEmailRequest {
  code: string;
}

export interface VerifyEmailResponse {
  message: string;
  token?: string;
}

export interface LoginRequest {
  email?: string;
  username?: string;
  password?: string;
  idToken?: string;
}

export const authApi = {
  register: (data: RegisterRequest) => 
    apiClient.post<RegisterResponse>('/user/register', data),
    
  login: (data: LoginRequest) => 
    apiClient.post<LoginResponse>('/user/login', data),
    
  verifyEmail: (data: VerifyEmailRequest) => 
    apiClient.post<VerifyEmailResponse>('/user/verify-email', data),
    
  resendVerification: () => 
    apiClient.post<{ message: string }>('/user/resend-verification-email', {}),
};
