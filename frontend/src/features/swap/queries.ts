import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { calculateSwap, CalculateSwapRequest } from './api';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export function useSwapPreview(params: CalculateSwapRequest | null) {
  const debouncedParams = useDebounce(params, 300);

  return useQuery(
    ['swapPreview', debouncedParams],
    () => {
      if (!debouncedParams) return Promise.reject(new Error('No params'));
      return calculateSwap(debouncedParams);
    },
    {
      enabled: !!debouncedParams && !!debouncedParams.amount && !!debouncedParams.from && !!debouncedParams.to,
      retry: false,
    }
  );
}

