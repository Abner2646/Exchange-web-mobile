import { useQuery } from "@tanstack/react-query"
import { depositService } from "../services/depositService"

export const useDeposits = () => {
  const {
    data: deposits = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["deposits"],
    queryFn: () => depositService.getDeposits(),
    staleTime: 300000, // 5 minutos
    gcTime: 600000, // 10 minutos (antes cacheTime)
  })

  return {
    deposits,
    isLoading,
    error,
  }
}
