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
  UpdateUserStatusRequest,
  UpdateUserRoleRequest,
  UpdateUserKycRequest,
  UpdateUserDailyLimitRequest,
  UpdateUserReputationRequest,
  UserAdminUpdateResponse,
  UserStatsResponse,
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
  // The backend wraps the list as { users: [...] } (not a bare array) — unwrap so the
  // query always yields AdminUser[] (a raw object here makes UsersAdmin's .filter/.map
  // throw and crashes the whole admin page via the error boundary).
  async listUsers() {
    const r = await apiClient.get<AdminUser[] | { users?: AdminUser[] }>('/user');
    return Array.isArray(r) ? r : (r?.users ?? []);
  },

  async searchUsers(q: string) {
    const r = await apiClient.get<AdminUser[] | { users?: AdminUser[] }>(`/user/search?q=${encodeURIComponent(q)}`);
    return Array.isArray(r) ? r : (r?.users ?? []);
  },

  async updateUserStatus(userId: string, body: UpdateUserStatusRequest) {
    return apiClient.patch<UserAdminUpdateResponse>(`/user/${userId}/status`, body);
  },

  async updateUserRole(userId: string, body: UpdateUserRoleRequest) {
    return apiClient.patch<UserAdminUpdateResponse>(`/user/${userId}/role`, body);
  },

  async updateUserKyc(userId: string, body: UpdateUserKycRequest) {
    return apiClient.patch<UserAdminUpdateResponse>(`/user/${userId}/kyc`, body);
  },

  async updateUserDailyLimit(userId: string, body: UpdateUserDailyLimitRequest) {
    return apiClient.patch<UserAdminUpdateResponse>(`/user/${userId}/daily-limit`, body);
  },

  async updateUserReputation(userId: string, body: UpdateUserReputationRequest) {
    return apiClient.patch<UserAdminUpdateResponse>(`/user/${userId}/reputation`, body);
  },

  async deleteUser(userId: string) {
    return apiClient.delete<void>(`/user/${userId}`);
  },

  // The backend returns grouped rows [{ role, kycVerified, active, country, total }].
  // Flatten them into a label→count summary the stats grid can render (an array here
  // would render as "[object Object]" chips).
  async getUserStats(): Promise<UserStatsResponse> {
    const r = await apiClient.get<UserStatsResponse | Array<Record<string, unknown>>>('/user/admin/stats');
    if (!Array.isArray(r)) return r;
    const out: Record<string, number> = { total: 0 };
    for (const row of r) {
      const n = Number(row.total) || 0;
      out.total += n;
      if (row.role) out[`role:${row.role}`] = (out[`role:${String(row.role)}`] ?? 0) + n;
      if (row.kycVerified) out.kycVerified = (out.kycVerified ?? 0) + n;
      if (row.active) out.active = (out.active ?? 0) + n;
    }
    return out;
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
