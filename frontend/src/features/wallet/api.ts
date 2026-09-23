import { apiClient } from '../../shared/api';
import type { CanonicalAmount } from '../../shared/money';

export interface CryptoCurrency {
  id: string;
  symbol: string;
  nombre: string;
  red?: string;
  decimales: number;
}

export interface CompartmentBalances {
  disponible: CanonicalAmount;
  bloqueado: CanonicalAmount;
  pendiente?: CanonicalAmount; // Spot might not have pendiente
}

export interface BalanceDTO {
  userId: string;
  criptomonedaId: string;
  balanceDisponible: CanonicalAmount;
  balanceBloqueado: CanonicalAmount;
  balancePendiente: CanonicalAmount;
  compartimentos: {
    funding: CompartmentBalances;
    spot: CompartmentBalances;
  };
  criptomoneda: CryptoCurrency;
}

export interface BalanceViewModel {
  id: string;
  symbol: string;
  name: string;
  total: {
    available: CanonicalAmount;
    blocked: CanonicalAmount;
    pending: CanonicalAmount;
  };
  funding: {
    available: CanonicalAmount;
    blocked: CanonicalAmount;
    pending: CanonicalAmount;
  };
  spot: {
    available: CanonicalAmount;
    blocked: CanonicalAmount;
  };
}

export async function fetchMyBalances(): Promise<BalanceViewModel[]> {
  const data = await apiClient.get<BalanceDTO[]>('/balances/my/balances');
  
  return data.map((dto) => ({
    id: dto.criptomonedaId,
    symbol: dto.criptomoneda.symbol,
    name: dto.criptomoneda.nombre,
    total: {
      available: dto.balanceDisponible,
      blocked: dto.balanceBloqueado,
      pending: dto.balancePendiente,
    },
    funding: {
      available: dto.compartimentos.funding.disponible,
      blocked: dto.compartimentos.funding.bloqueado,
      pending: dto.compartimentos.funding.pendiente ?? ('0' as CanonicalAmount),
    },
    spot: {
      available: dto.compartimentos.spot.disponible,
      blocked: dto.compartimentos.spot.bloqueado,
    },
  }));
}

export interface TransferInternalPayload {
  criptomonedaId: string;
  cantidad: string;
  origen: 'funding' | 'spot';
  destino: 'funding' | 'spot';
}

export async function transferInternal(payload: TransferInternalPayload): Promise<void> {
  await apiClient.post('/balances/my/transfer', payload);
}
