import { apiClient } from '../../shared/api';

export interface Profile {
  id: string;
  username: string; // IMMUTABLE
  email: string;
  displayName?: string; // Editable
  pais?: string;
  estado?: string;
  country?: string; // fallback
  state?: string; // fallback
  locale?: string; // Editable
}

export interface UpdateProfileRequest {
  displayName?: string;
  pais?: string;
  estado?: string;
  locale?: string;
}

export interface EmailChangeRequest {
  nuevoEmail: string;
  passwordActual: string;
}

export interface EmailChangeConfirmRequest {
  codigo: string;
}

export interface EmailChangeConfirmResponse {
  message: string;
  token?: string;
}

export const profileApi = {
  fetchProfile: () => apiClient.get<Profile>('/usuario/me'),
  updateProfile: (data: UpdateProfileRequest) => apiClient.patch<Profile>('/usuario/me', data),
  requestEmailChange: (data: EmailChangeRequest) => apiClient.post<{ message: string }>('/usuario/me/email-change', data),
  confirmEmailChange: (data: EmailChangeConfirmRequest) => apiClient.post<EmailChangeConfirmResponse>('/usuario/me/email-change/confirm', data),
};
