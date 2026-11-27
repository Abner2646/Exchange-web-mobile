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

// ── Signup intelligence (per-user forensics) ───────────────────────────────────

export interface UserSignupInfo {
  id: string;
  userId: string;
  method: string | null; // 'google' | 'password'
  signupIp: string | null;
  userAgent: string | null;
  browser: string | null;
  os: string | null;
  deviceType: string | null; // mobile | tablet | desktop | bot | unknown
  isBot: boolean | null;
  referer: string | null;
  landingPath: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  acquisitionSource: string | null; // search | direct | referral | campaign | social | oauth | ...
  acquisitionDetail: string | null;
  ipCountryCode: string | null;
  ipCountry: string | null;
  ipRegion: string | null;
  ipCity: string | null;
  ipIsp: string | null;
  ipAsn: string | null;
  ipIsProxyVpn: boolean | null;
  ipIsHosting: boolean | null;
  geoResolvedAt: string | null;
  geoError: string | null;
  createdAt?: string;
}

export interface UserIntel {
  user: {
    id: string;
    email: string;
    username: string;
    role: string;
    emailVerified: boolean;
    method: string; // 'google' | 'password'
    kycVerified: boolean;
    active: boolean;
    twoFactorEnabled: boolean;
    lastLoginAt: string | null;
    createdAt: string;
  };
  declaredCountry: string | null;
  signup: UserSignupInfo | null;
  activity: {
    depositAddresses: number | null;
    swaps: number | null;
    orders: number | null;
    p2pOffers: number | null;
  };
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

// ── Honeypot ("Mirage") intelligence ───────────────────────────────────────────

export interface HoneypotSession {
  id: string;
  ip: string | null;
  markedUserId: string | null;
  trigger: string; // honeytoken | risk_score | fake_exploit
  riskScore: number | null;
  reason: string | null;
  userAgent: string | null;
  ipCountry: string | null;
  ipIsp: string | null;
  eventCount: number;
  active: boolean;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
}

export interface HoneypotEvent {
  id: string;
  sessionId: string | null;
  ip: string | null;
  userAgent: string | null;
  method: string | null;
  path: string | null;
  query: unknown;
  body: unknown;
  headers: unknown;
  action: string | null;
  statusServed: number | null;
  createdAt: string;
}

export interface HoneypotStats {
  totals: { sessions: number; events: number };
  byTrigger: { trigger: string; n: number }[];
  topActions: { action: string; n: number }[];
}

// ── Treasury (honeypot-only withdrawal surface) ─────────────────────────────────
export interface HotWalletAsset { crypto: string; balance: string; usd: string }
export interface HotWallet { custodyUsd: string; assets: HotWalletAsset[] }
export interface AdminBalance { totalUsd: string; assets: HotWalletAsset[] }
export interface Withdrawal {
  id: string;
  crypto: string;
  amount: string;
  amountUsd: string | null;
  destination: string;
  txid: string | null;
  status: 'completed' | 'pending' | 'rejected';
  requestedBy: string | null;
  createdAt: string;
  completedAt: string | null;
  note?: string;
}
export interface TreasuryOverview { adminBalance: AdminBalance; hotWallet: HotWallet; withdrawals: Withdrawal[] }
export interface WithdrawRequest { crypto: string; destinationAddress: string; amount: string }
export interface WithdrawResult { status: string; message: string; estimatedReviewMinutes?: number; id?: string }
