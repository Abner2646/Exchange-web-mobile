import { apiClient } from '@/shared/api';
import {
  PendingActionsResponse,
  ApproveRequest,
  RejectRequest,
  MfaReadiness,
  BusinessConfigResponse,
  ConfigUpsertRequest,
  AmlConfig,
  DenylistAddress,
  DenylistAddRequest,
  AmlCase,
  ResolveCaseRequest,
  AdminUser,
  AuditListResponse,
  AuditVerifyResult,
  AuditQueryParams,
} from './types';

export const adminApi = {
  // Governance
  async getPending() {
    return apiClient.get<PendingActionsResponse>('/governance/pending');
  },

  async getReadiness() {
    return apiClient.get<MfaReadiness>('/governance/readiness');
  },

  async approveAction(id: string, body: ApproveRequest) {
    return apiClient.post<void>(`/governance/${id}/approve`, body);
  },

  async rejectAction(id: string, body: RejectRequest) {
    return apiClient.post<void>(`/governance/${id}/reject`, body);
  },

  // Config
  async getConfig(category?: string) {
    const url = category ? `/config?category=${category}` : '/config';
    return apiClient.get<BusinessConfigResponse>(url);
  },

  async upsertConfig(key: string, body: ConfigUpsertRequest) {
    return apiClient.put<BusinessConfigResponse>(`/config/${key}`, body);
  },

  // AML
  async getAmlConfig() {
    return apiClient.get<AmlConfig>('/aml/config');
  },

  async setAmlConfig(key: string, value: string) {
    return apiClient.put<void>(`/aml/config/${key}`, { value });
  },

  async getDenylist() {
    return apiClient.get<DenylistAddress[]>('/aml/denylist');
  },

  async addDenylist(body: DenylistAddRequest) {
    return apiClient.post<DenylistAddress>('/aml/denylist', body);
  },

  async removeDenylist(id: string) {
    return apiClient.delete<void>(`/aml/denylist/${id}`);
  },

  async getCases(status?: string) {
    const url = status ? `/aml/cases?status=${status}` : '/aml/cases';
    return apiClient.get<AmlCase[]>(url);
  },

  async resolveCase(id: string, body: ResolveCaseRequest) {
    return apiClient.put<void>(`/aml/cases/${id}/resolve`, body);
  },

  // Users
  async listUsers() {
    return apiClient.get<AdminUser[]>('/user');
  },

  async searchUsers(q: string) {
    return apiClient.get<AdminUser[]>(`/user/search?q=${encodeURIComponent(q)}`);
  },

  async updateUserStatus(userId: string, body: Record<string, unknown>) {
    return apiClient.patch<void>(`/user/${userId}/status`, body);
  },

  async updateUserRole(userId: string, body: Record<string, unknown>) {
    return apiClient.patch<void>(`/user/${userId}/role`, body);
  },

  async updateUserKyc(userId: string, body: Record<string, unknown>) {
    return apiClient.patch<void>(`/user/${userId}/kyc`, body);
  },

  async updateUserDailyLimit(userId: string, body: Record<string, unknown>) {
    return apiClient.patch<void>(`/user/${userId}/daily-limit`, body);
  },

  async updateUserReputation(userId: string, body: Record<string, unknown>) {
    return apiClient.patch<void>(`/user/${userId}/reputation`, body);
  },

  async deleteUser(userId: string) {
    return apiClient.delete<void>(`/user/${userId}`);
  },

  async getUserStats() {
    return apiClient.get<Record<string, unknown>>('/user/admin/stats');
  },

  // Audit
  async getAudit(params?: AuditQueryParams) {
    if (!params || Object.keys(params).length === 0) {
      return apiClient.get<AuditListResponse>('/audit');
    }

    const queryParts: string[] = [];
    if (params.eventType) queryParts.push(`eventType=${params.eventType}`);
    if (params.aggregateId) queryParts.push(`aggregateId=${params.aggregateId}`);
    if (params.limit !== undefined) queryParts.push(`limit=${params.limit}`);
    if (params.beforeId !== undefined) queryParts.push(`beforeId=${params.beforeId}`);

    const queryString = queryParts.join('&');
    const url = `/audit${queryString ? '?' + queryString : ''}`;
    return apiClient.get<AuditListResponse>(url);
  },

  async verifyAudit() {
    return apiClient.get<AuditVerifyResult>('/audit/verify');
  },
};
