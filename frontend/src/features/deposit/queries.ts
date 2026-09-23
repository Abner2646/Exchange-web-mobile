import { useQuery } from 'react-query';
import { fetchActiveCryptos, fetchDepositAddress } from './api';

export function useActiveCryptos() {
  return useQuery('activeCryptos', fetchActiveCryptos, {
    staleTime: 5 * 60 * 1000,
  });
}

export function useDepositAddress(cryptoId: string | null) {
  return useQuery(
    ['depositAddress', cryptoId],
    () => {
      if (!cryptoId) return Promise.reject(new Error('No cryptoId provided'));
      return fetchDepositAddress(cryptoId);
    },
    {
      enabled: !!cryptoId,
      retry: false,
    }
  );
}
