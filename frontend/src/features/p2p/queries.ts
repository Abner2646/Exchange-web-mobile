import { useQuery, UseQueryResult } from 'react-query';
import { fetchOffers, P2PResponse, P2POfferFilters } from './api';
import { ApiError } from '../../shared/api';

export const p2pQueryKeys = {
  offers: (filters: P2POfferFilters) => ['p2p', 'offers', filters] as const,
};

export function useOffers(filters: P2POfferFilters): UseQueryResult<P2PResponse, ApiError> {
  return useQuery<P2PResponse, ApiError>(
    p2pQueryKeys.offers(filters),
    () => fetchOffers(filters),
    {
      keepPreviousData: true,
    }
  );
}
