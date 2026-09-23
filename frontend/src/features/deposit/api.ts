import { apiClient } from '../../shared/api';

export interface CryptoCurrency {
  id: string;
  symbol: string;
  nombre: string;
  red?: string;
  network?: string; // Fallback
  decimales: number;
}

export interface DepositAddressDTO {
  id: string;
  address: string;
  userId: string;
  cryptoId: string;
}

export async function fetchActiveCryptos(): Promise<CryptoCurrency[]> {
  return apiClient.get<CryptoCurrency[]>('/crypto/public/active');
}

export async function fetchDepositAddress(cryptoId: string): Promise<DepositAddressDTO> {
  return apiClient.get<DepositAddressDTO>(`/direccionDeposito/user/me/crypto/${cryptoId}`);
}
