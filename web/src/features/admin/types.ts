export interface PendingAction {
  id: string;
  actionType: string;
  payload: Record<string, unknown>;
  amountUsd: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'executed' | 'failed';
  makerUserId: string;
  checkerUserId: string | null;
  rejectionReason: string | null;
  result: Record<string, unknown> | null;
  expiresAt: string;
  resolvedAt: string | null;
  created_at: string;
}

export interface PendingActionsResponse {
  pending: PendingAction[];
}

export interface ApproveRequest {
  codigo: string;
}

export interface RejectRequest {
  reason?: string;
}

export interface OperatorSummary {
  id: string;
  email: string;
  role: string;
  active: boolean;
  totpEnabled: boolean;
  twoFactorEnabled: boolean;
}

export interface MfaReadiness {
  ready: boolean;
  operatorCount: number;
  enrolledCount: number;
  minEnrolled: number;
  enrolled: OperatorSummary[];
  pending: OperatorSummary[];
  reasons: string[];
}

export interface BusinessConfigItem {
  key: string;
  value: string;
  type?: string;
  category?: string | null;
  description?: string | null;
}

export interface BusinessConfigResponse {
  data: BusinessConfigItem[];
}

export interface ConfigUpsertRequest {
  value: string;
  type?: 'string' | 'number' | 'boolean' | 'json';
  category?: string;
  description?: string;
}

export interface AmlConfig {
  monitoringEnabled: boolean;
  holdEnforcementEnabled: boolean;
}

export interface DenylistAddress {
  id: string;
  address: string;
  network: string;
  reason?: string | null;
  source?: string | null;
}

export interface DenylistAddRequest {
  address: string;
  network: string;
  reason?: string;
  source?: string;
}

export interface AmlCase {
  id: string;
  status: string;
  signalId?: string;
  evidence?: Record<string, unknown>;
  created_at?: string;
}

export interface ResolveCaseRequest {
  decision: 'approve' | 'reject';
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  active: boolean;
  kycVerified?: boolean;
  kycLevel?: string;
  dailyLimit?: string;
  dailyLimitUsd?: string;
  averageRating?: number;
  totalRatings?: number;
}

// ── User-admin request body types ─────────────────────────────────────────────

export interface UpdateUserStatusRequest {
  active: boolean;
}

export interface UpdateUserRoleRequest {
  role: string;
}

export interface UpdateUserKycRequest {
  verified: boolean;
  kycData?: Record<string, unknown>;
}

export interface UpdateUserDailyLimitRequest {
  /** Decimal string — never parseFloat */
  dailyLimitUsd: string;
}

export interface UpdateUserReputationRequest {
  averageRating: number;
  totalRatings?: number;
}

export interface UserAdminUpdateResponse {
  /** Token belongs to the TARGET user — the admin MUST NOT call session.setToken with it */
  token: string;
  user: AdminUser;
}

export interface UserStatsResponse {
  [key: string]: unknown;
}

export interface AuditRow {
  id: number;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  aggregateId: string | null;
  occurredAt: string;
  prevHash: string | null;
  hash: string;
  created_at: string;
}

export interface AuditListResponse {
  rows: AuditRow[];
  nextBeforeId: number | null;
}

export interface AuditVerifyResult {
  ok: boolean;
  brokenAtSeq: number | null;
  checked: number;
}

export interface AuditQueryParams {
  eventType?: string;
  aggregateId?: string;
  limit?: number;
  beforeId?: number;
}
