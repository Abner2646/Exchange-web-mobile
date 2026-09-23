import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from 'react-query';
import {
  fetchPendingActions,
  approveAction,
  rejectAction,
  proposeAction,
  fetchConfig,
  updateConfig,
  GovernancePendingResponse,
  PendingAdminAction,
  ApproveActionRequest,
  RejectActionRequest,
  ProposeActionRequest,
  FetchConfigResponse,
  UpdateConfigResponse,
  BusinessConfigItem
} from './api';

export const adminQueryKeys = {
  pendingActions: ['governance', 'pending'] as const,
  businessConfig: ['config'] as const,
};

export function usePendingActions(): UseQueryResult<GovernancePendingResponse, unknown> {
  return useQuery(adminQueryKeys.pendingActions, fetchPendingActions);
}

export function useApproveAction(): UseMutationResult<PendingAdminAction, unknown, ApproveActionRequest, unknown> {
  const queryClient = useQueryClient();
  
  return useMutation(approveAction, {
    onSuccess: () => {
      queryClient.invalidateQueries(adminQueryKeys.pendingActions);
    }
  });
}

export function useRejectAction(): UseMutationResult<PendingAdminAction, unknown, RejectActionRequest, unknown> {
  const queryClient = useQueryClient();
  
  return useMutation(rejectAction, {
    onSuccess: () => {
      queryClient.invalidateQueries(adminQueryKeys.pendingActions);
    }
  });
}

export function useProposeAction(): UseMutationResult<PendingAdminAction, unknown, ProposeActionRequest, unknown> {
  const queryClient = useQueryClient();
  
  return useMutation(proposeAction, {
    onSuccess: () => {
      queryClient.invalidateQueries(adminQueryKeys.pendingActions);
    }
  });
}

export function useBusinessConfig(): UseQueryResult<FetchConfigResponse, unknown> {
  return useQuery(adminQueryKeys.businessConfig, fetchConfig);
}

export function useUpdateConfig(): UseMutationResult<UpdateConfigResponse, unknown, BusinessConfigItem, unknown> {
  const queryClient = useQueryClient();
  
  return useMutation(updateConfig, {
    onSuccess: () => {
      queryClient.invalidateQueries(adminQueryKeys.businessConfig);
    }
  });
}
