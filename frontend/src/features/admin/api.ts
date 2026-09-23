import { apiClient } from '../../shared/api';
import type { CanonicalAmount } from '../../shared/money';

export interface PendingAdminAction {
  id: string;
  actionType: string;
  payload: any;
  amountUsd: CanonicalAmount | null;
  status: string;
  makerUserId: string;
  created_at: string;
  expires_at: string;
}

export interface GovernancePendingResponse {
  pending: PendingAdminAction[];
}

export interface ProposeActionRequest {
  actionType: string;
  payload: any;
  amountUsd?: CanonicalAmount;
}

export interface ApproveActionRequest {
  id: string;
  codigo: string;
}

export interface RejectActionRequest {
  id: string;
  reason?: string;
}

export interface BusinessConfigItem {
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  category?: string | null;
  description?: string | null;
}

export interface FetchConfigResponse {
  data: BusinessConfigItem[];
}

export interface UpdateConfigResponse {
  message: string;
  data: BusinessConfigItem;
}

export async function fetchPendingActions(): Promise<GovernancePendingResponse> {
  return apiClient.get<GovernancePendingResponse>('/governance/pending');
}

export async function approveAction({ id, codigo }: ApproveActionRequest): Promise<PendingAdminAction> {
  return apiClient.post<PendingAdminAction>(`/governance/${id}/approve`, { codigo });
}

export async function rejectAction({ id, reason }: RejectActionRequest): Promise<PendingAdminAction> {
  return apiClient.post<PendingAdminAction>(`/governance/${id}/reject`, { reason });
}

export async function proposeAction(body: ProposeActionRequest): Promise<PendingAdminAction> {
  return apiClient.post<PendingAdminAction>('/governance/propose', body);
}

export async function fetchConfig(): Promise<FetchConfigResponse> {
  return apiClient.get<FetchConfigResponse>('/config');
}

export async function updateConfig(item: BusinessConfigItem): Promise<UpdateConfigResponse> {
  return apiClient.put<UpdateConfigResponse>(`/config/${item.key}`, {
    value: item.value,
    type: item.type,
    category: item.category,
    description: item.description,
  });
}
