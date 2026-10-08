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

export interface AuthSession {
  user: User;
  token: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
  displayName?: string;
}

/** Register returns a TEMPORAL token used only to verify the email. */
export interface RegisterResponse {
  message: string;
  user: User;
  token: string;
}

export interface VerifyEmailRequest {
  codigo: string;
}

export interface VerifyEmailResponse {
  message: string;
  user: User;
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TwoFactorChallenge {
  requires2FA: true;
  twoFactorMethod: 'totp' | 'email';
  temporalToken: string;
}

export type LoginResult = AuthSession | TwoFactorChallenge;

export function isTwoFactorChallenge(r: LoginResult): r is TwoFactorChallenge {
  return (r as TwoFactorChallenge).requires2FA === true;
}

export interface Verify2FARequest {
  temporalToken: string;
  codigo: string;
}

export interface Resend2FARequest {
  temporalToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyResetCodeRequest {
  email: string;
  codigo: string;
}

export interface ResetPasswordRequest {
  email: string;
  codigo: string;
  newPassword: string;
  confirmPassword: string;
}

export interface GoogleLoginRequest {
  idToken: string;
}
