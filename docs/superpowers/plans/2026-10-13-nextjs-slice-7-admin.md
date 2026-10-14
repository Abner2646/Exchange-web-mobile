# Next.js Slice 7 (Admin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Admin vertical in the Next.js `web/` app — a least-privilege-routed `/admin` panel that mounts the already-built backend admin surface: the Maker-Checker governance inbox (approve/reject with TOTP), operator-MFA readiness, user management (with super-admin-only sub-actions), business-config editing, AML ops (config/denylist/cases), and a read-only hash-chain audit viewer.

**Architecture:** Mirrors the S1–S6 feature pattern: `web/src/features/admin/{roles.ts,types.ts,api.ts,queries.ts,components/*,index.ts}` + a client-rendered `/admin` route under `web/app/(app)/`, gated by a role check on `useCurrentUser().data.role`. Two **additive, read-only** backend endpoints are added first (Tasks 1–2) to expose state that exists only as an internal service/CLI gate today (`operatorReadiness.service`, `verifyAuditChain`); both reuse already-tested pure logic. Governance approve, business-config writes, AML writes, and privileged user mutations are **coordinator-reviewed** (privileged/security surface — treat like money-path).

**Tech Stack:** Node/Express/Sequelize backend (Jest/supertest); Next.js 14.2.35 App Router (React 18), TanStack Query v5, Vitest + Testing Library, the shared `@/shared/{api,i18n,ui}` modules.

## Global Constraints

- **React 18 / Next 14.2.35.** No React 19 APIs. All interactive components start with `'use client'`.
- **Least-privilege routing is the headline requirement.** Role hierarchy (backend `utils/authz.js` + `middleware/adminMiddleware.js`): `normal(1) < admin(2) < super_admin(3)` with aliases `usuario/user→1`, `administrator→2`, `superadmin/super-admin→3`. The `/admin` route and its nav link must be invisible AND unreachable for level < 2; super-admin-only actions (change user role, delete user) must be hidden/disabled for level 2.
- **Backend mount paths are the legacy ones**, passed to `apiClient` WITHOUT an `/api` prefix (same convention as every prior slice): `/governance/*`, `/config`, `/config/:key`, `/aml/*`, `/user`, `/user/:id`, `/user/:id/*`, `/user/admin/*`, `/user/search`, plus the two new `/governance/readiness` and `/audit[/verify]`.
- **Request body field names are the backend's EXACT names** (confirm each against the controller before wiring — some are Spanish). Governance approve sends `{ codigo }` (TOTP), reject sends `{ reason }`. AML denylist-add sends `{ address, network, reason?, source? }`; AML case resolve sends `{ decision: 'approve'|'reject' }`; AML config set sends `{ value }` to a key starting `aml.`. Business-config upsert sends `{ value, type?, category?, description? }`. User-admin PATCH bodies are locked by reading `user.controller.js` in Task 7 — do NOT invent them.
- **No money-SPEND path in the panel.** Privileged balance movements already route through Maker-Checker and surface in the governance inbox as pending actions; admin never posts a balance mutation directly from this slice. `amountUsd` on a pending action is a **canonical decimal string** — render it as-is, never `parseFloat`.
- **Error copy comes from the error catalog** via `useErrorTranslation().tError(code, params)`. When a code may be `INTERNAL_ERROR`, pass `{ requestId: err.requestId }`.
- **i18n:** add keys under an `admin.*` namespace to BOTH `en` and `es` catalogs (flat dotted keys under `ui`, e.g. `'admin.tab.governance'`; this is the real catalog shape). A parity test enforces en==es. Add `nav.admin`. fr/it/pt out of scope.
- **Shared signatures (confirmed in S6, pass verbatim):**
  - `useTranslation()` → `{ t, locale }`; `t(key, params?)`.
  - `useErrorTranslation()` (from `@/shared/i18n`) → `{ tError }`; `tError(code, params?)`.
  - `Field` (`@/shared/ui`): `{ label, helpText?, error?, children }`, no `htmlFor`, clones ONE child carrying its own `id`.
  - `Button` (`@/shared/ui`): `variant`, `size`, `loading`, `disabled`.
  - `Dialog` (`@/shared/ui`): `{ isOpen, onClose, title, children, closeOnClickOutside? }`.
  - `apiClient` (`@/shared/api`): `get/post/put/patch/delete<T>(url, body?, options?)`. `ApiError`: `{ code, message, status, requestId? }`. Type queries/mutations `<T, ApiError>`.
  - Current user: `useCurrentUser()` (from `@/features/auth/queries`) → `{ data: User | null }`; the exported query key is **`USER_QUERY_KEY = ['auth','user']`**. `User.role: string`.
- **git add is EXPLICIT per commit** (never `git add -A`/`.`/`commit -am`). Backend tasks that touch shared files (`backend/routes/index.js`) run `cd backend && npm test` before committing.

---

## Backend Contract (grounded reference — read before coding)

Sources: `backend/modules/governance/{governance.routes,governance.controller,pendingAdminAction.entity,operatorReadiness.service}.js`, `backend/modules/aml/{aml.routes,aml.controller}.js`, `backend/modules/config/{businessConfig.routes,businessConfig.controller,businessConfig.entity}.js`, `backend/modules/users/{user.routes,user.controller}.js`, `backend/modules/audit/{verifyAuditChain,auditLog.entity}.js`, `backend/routes/index.js`. **Route/controller file wins on any conflict with this doc or the contract doc.**

### Governance — `/governance` (auth + `requireOperatorMFA` on every route)
- `GET /governance/pending` → `{ pending: PendingAdminAction[] }` (status='pending', ordered created_at ASC).
- `POST /governance/:id/approve` → body `{ codigo }` (checker's TOTP; must be a DISTINCT operator from the maker) → `200` the executed action. `401` bad/replayed/not-enrolled TOTP; `404` unknown id; typed 4xx for maker===checker / already-resolved.
- `POST /governance/:id/reject` → body `{ reason? }` → `200` the rejected action.
- `POST /governance/propose` exists but is driven by backend services; the panel does NOT expose a generic propose form in this slice.
- **NEW (Task 1):** `GET /governance/readiness` → `assessMfaReadiness(loadOperators())` = `{ ready: boolean, operatorCount, enrolledCount, minEnrolled, enrolled: OperatorSummary[], pending: OperatorSummary[], reasons: string[] }` where `OperatorSummary = { id, email, role, active, totpEnabled, twoFactorEnabled }`.

`PendingAdminAction` (entity): `{ id: string(uuid), actionType: string, payload: object, amountUsd: string|null, status: 'pending'|'approved'|'rejected'|'expired'|'executed'|'failed', makerUserId: string, checkerUserId: string|null, rejectionReason: string|null, result: object|null, expiresAt: string, resolvedAt: string|null, created_at: string, updated_at: string }`.

### Business config — `/config` (auth + `isAdmin` + `requireOperatorMFA`)
- `GET /config?category=` → `{ data: BusinessConfig[] }` (ordered by key ASC).
- `GET /config/:key` → `{ data: BusinessConfig }` (`404` CONFIG_NOT_FOUND).
- `PUT /config/:key` → body `{ value, type?: 'string'|'number'|'boolean'|'json', category?, description? }` → `{ message, data: BusinessConfig }`. `400` CONFIG_INVALID_INPUT if value empty or type invalid.
- `BusinessConfig` shape: confirm fields in `businessConfig.entity.js` in Task 9 (expected `{ key, value, type, category, description }`).

### AML — `/aml` (auth + `isAdmin` + `requireOperatorMFA`)
- `GET /aml/config` → `{ monitoringEnabled: boolean, holdEnforcementEnabled: boolean }`.
- `PUT /aml/config/:key` → body `{ value }`; key MUST start with `aml.` → `{ key, value }` (`400` otherwise).
- `GET /aml/denylist` → `DenylistAddress[]`.
- `POST /aml/denylist` → body `{ address, network, reason?, source? }` → `201` the row (`400` if address/network missing).
- `DELETE /aml/denylist/:id` → `{ removed: number }`.
- `GET /aml/cases?status=` → `Case[]`.
- `PUT /aml/cases/:id/resolve` → body `{ decision: 'approve'|'reject' }` → the resolved case. `400` bad decision; `404` not found; `409` already resolved. (approve clears a held S5 withdrawal; reject refunds it — tipping-off: case data is admin-only.)

### User management — `/user`
- `GET /user` (isAdmin) → list of users.
- `GET /user/search?q=` (authed) → search results.
- `GET /user/:id` (authed; admin sees full profile) → user.
- `PATCH /user/:id/status` (isAdmin), `PATCH /user/:id/kyc` (isAdmin), `PATCH /user/:id/daily-limit` (isAdmin), `PATCH /user/:id/reputation` (isAdmin) — **bodies locked in Task 7 from `user.controller.js`**.
- `PATCH /user/:id/role` (isSuperAdmin), `DELETE /user/:id` (isSuperAdmin) — super-admin only.
- `GET /user/:id/daily-volume`, `GET /user/:id/transaction-limit` (isAdmin).
- `GET /user/admin/stats` (isAdmin), `POST /user/admin/deactivate-inactive` (isAdmin).

### Audit — NEW (Task 2), read-only, `isAdmin`
- `GET /audit?eventType=&aggregateId=&limit=&beforeId=` → `{ rows: AuditLog[], nextBeforeId: number|null }` (ordered id DESC; `limit` clamped 1..100, default 50; `beforeId` = keyset cursor).
- `GET /audit/verify` → `verifyAuditChain()` = `{ ok: boolean, brokenAtSeq: number|null, checked: number }`.
- `AuditLog` row: `{ id: number, eventId, eventType, payload, aggregateId: string|null, occurredAt, prevHash: string|null, hash, created_at }`.

---

## File Structure

```
backend/modules/governance/governance.routes.js        # ADD GET /readiness
backend/modules/governance/governance.controller.js    # ADD readiness handler
backend/modules/governance/governance.controller.test.js # ADD readiness test
backend/modules/audit/audit.controller.js   (new)       # list + verify
backend/modules/audit/audit.routes.js       (new)       # GET /audit, GET /audit/verify (isAdmin)
backend/modules/audit/audit.controller.test.js (new)
backend/routes/index.js                                 # mount /audit
web/src/features/admin/
  roles.ts  / roles.test.ts            # roleLevel/isAdmin/isSuperAdmin (mirror backend hierarchy)
  types.ts                             # PendingAdminAction, MfaReadiness, BusinessConfigItem, AmlConfig, DenylistAddress, AmlCase, AdminUser, AuditRow, request types
  api.ts  / api.test.ts                # adminApi: governance, config, aml, users, audit
  queries.ts / queries.test.tsx        # hooks + mutations (retry:false; invalidate on success)
  i18nAdminKeys.test.ts                # en/es parity for admin.* keys
  index.ts                             # barrel exporting AdminPage
  components/
    admin.module.css
    GovernanceInbox.tsx / .test.tsx         # pending list + approve(TOTP)/reject  [coordinator-reviewed]
    OperatorReadinessCard.tsx / .test.tsx   # readiness summary (go-live gate visibility)
    UsersAdmin.tsx / .test.tsx              # search/list + privileged mutations; super-only gated
    BusinessConfigEditor.tsx / .test.tsx    # list + upsert  [coordinator-reviewed]
    AmlOps.tsx / .test.tsx                  # config toggles + denylist CRUD + cases resolve  [coordinator-reviewed]
    AuditViewer.tsx / .test.tsx             # read-only chain viewer + verify badge
    AdminTabs.tsx / .test.tsx               # tab shell (Governance | Users | Config | AML | Audit)
web/src/features/admin/AdminGate.tsx / .test.tsx  # role gate wrapper (redirect level<2)
web/app/(app)/admin/page.tsx            # client route rendering <AdminGate><AdminPage/></AdminGate>
web/app/(app)/layout.tsx                # role-conditional /admin nav link
docs/frontend-rebuild/backend-contract-changes.md  # add §23
```

---

### Task 1: Backend — `GET /governance/readiness` (coordinator-reviewed)

**Files:** Modify `backend/modules/governance/governance.controller.js`, `backend/modules/governance/governance.routes.js`; Modify `backend/modules/governance/governance.controller.test.js`.

**Interfaces — Produces:** HTTP `GET /governance/readiness` → `assessMfaReadiness` result. Reuses the already-tested pure `operatorReadiness.service` (`loadOperators` + `assessMfaReadiness`) — no new logic, no sensitive fields echoed (the service projects only `{ id,email,role,active,totpEnabled,twoFactorEnabled }`).

- [ ] **Step 1: Write the failing test** — append to `governance.controller.test.js` (mirror the existing controller-test style there: mock the service, call the handler with a fake `req/res`):
```js
const readiness = require('./operatorReadiness.service');

describe('governance.controller.readiness', () => {
  it('returns assessMfaReadiness over loaded operators', async () => {
    jest.spyOn(readiness, 'loadOperators').mockResolvedValue([
      { id: 'a', email: 'a@x.co', role: 'admin', active: true, totpEnabled: true, twoFactorEnabled: true },
      { id: 'b', email: 'b@x.co', role: 'admin', active: true, totpEnabled: false, twoFactorEnabled: true },
    ]);
    const req = {}; const res = { json: jest.fn() };
    await controller.readiness(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ready: false, operatorCount: 2, enrolledCount: 1, minEnrolled: 2,
    }));
  });
});
```
- [ ] **Step 2: Run** `cd backend && npx jest modules/governance/governance.controller.test.js` → FAIL (`controller.readiness` not a function).
- [ ] **Step 3: Implement** — in `governance.controller.js` add:
```js
const operatorReadiness = require('./operatorReadiness.service');

async function readiness(req, res) {
  const operators = await operatorReadiness.loadOperators();
  res.json(operatorReadiness.assessMfaReadiness(operators));
}
```
and export it (`module.exports = { propose, approve, reject, listPending, readiness };`). In `governance.routes.js` add (same guard chain as `/pending`), with an `@openapi` block mirroring `/pending`:
```js
router.get('/readiness', authenticateToken, requireOperatorMFA, asyncHandler(governanceController.readiness));
```
- [ ] **Step 4: Run** `cd backend && npx jest modules/governance/governance.controller.test.js` → PASS. Then `cd backend && npm test` (governance.routes is not a cross-cutting file, but the controller is imported by the route wiring — run the governance suite + a smoke of the full suite).
- [ ] **Step 5: Commit** (`git add backend/modules/governance/governance.controller.js backend/modules/governance/governance.routes.js backend/modules/governance/governance.controller.test.js`): `feat(governance): read-only operator-MFA readiness endpoint (Slice 7 Task 1)`

---

### Task 2: Backend — read-only audit viewer endpoint (coordinator-reviewed)

**Files:** Create `backend/modules/audit/{audit.controller.js,audit.routes.js,audit.controller.test.js}`; Modify `backend/routes/index.js` (mount `/audit`).

**Interfaces — Produces:** `GET /audit` (keyset-paginated list, id DESC) and `GET /audit/verify` (chain integrity). Reuses the tested `verifyAuditChain`. Read-only; no mutation of the tamper-evident log.

- [ ] **Step 1: Write the failing test** `audit.controller.test.js` — mock the model + verifier, assert clamping + cursor + verify passthrough:
```js
jest.mock('../../models', () => ({ AuditLog: { findAll: jest.fn() } }));
jest.mock('./verifyAuditChain', () => ({ verifyAuditChain: jest.fn() }));
const { AuditLog } = require('../../models');
const { verifyAuditChain } = require('./verifyAuditChain');
const controller = require('./audit.controller');

beforeEach(() => jest.clearAllMocks());

describe('audit.controller', () => {
  it('list clamps limit, applies beforeId cursor, returns nextBeforeId', async () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ id: 100 - i, toJSON() { return { id: 100 - i }; } }));
    AuditLog.findAll.mockResolvedValue(rows);
    const req = { query: { limit: '500', beforeId: '101', eventType: 'withdrawal.completed' }, };
    const res = { json: jest.fn() };
    await controller.list(req, res);
    const args = AuditLog.findAll.mock.calls[0][0];
    expect(args.limit).toBe(100);                 // clamped to max
    expect(args.order).toEqual([['id', 'DESC']]);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ nextBeforeId: 51 }));
  });
  it('verify passes through the chain result', async () => {
    verifyAuditChain.mockResolvedValue({ ok: true, brokenAtSeq: null, checked: 7 });
    const res = { json: jest.fn() };
    await controller.verify({}, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true, brokenAtSeq: null, checked: 7 });
  });
});
```
- [ ] **Step 2: Run** `cd backend && npx jest modules/audit/audit.controller.test.js` → FAIL.
- [ ] **Step 3: Implement** `audit.controller.js`:
```js
// modules/audit/audit.controller.js
// Read-only admin viewer over the tamper-evident audit_log. Never mutates the chain.
const { Op } = require('sequelize');
const { verifyAuditChain } = require('./verifyAuditChain');

const MAX_LIMIT = 100;

async function list(req, res) {
  const { AuditLog } = require('../../models');
  const raw = parseInt(req.query.limit, 10);
  const limit = Number.isInteger(raw) ? Math.min(Math.max(raw, 1), MAX_LIMIT) : 50;
  const where = {};
  if (req.query.eventType) where.eventType = req.query.eventType;
  if (req.query.aggregateId) where.aggregateId = req.query.aggregateId;
  const beforeId = parseInt(req.query.beforeId, 10);
  if (Number.isInteger(beforeId)) where.id = { [Op.lt]: beforeId };

  const found = await AuditLog.findAll({ where, order: [['id', 'DESC']], limit });
  const rows = found.map((r) => (typeof r.toJSON === 'function' ? r.toJSON() : r));
  const nextBeforeId = rows.length === limit ? Number(rows[rows.length - 1].id) : null;
  res.json({ rows, nextBeforeId });
}

async function verify(req, res) {
  res.json(await verifyAuditChain());
}

module.exports = { list, verify };
```
`audit.routes.js` (read-only → `isAdmin` is sufficient; no write, so no `requireOperatorMFA`), with `@openapi` blocks per the OpenAPI convention:
```js
const { Router } = require('express');
const router = Router();
const { authenticateToken } = require('../../middleware/authMiddleware');
const { isAdmin } = require('../../middleware/adminMiddleware');
const asyncHandler = require('../../utils/asyncHandler');
const controller = require('./audit.controller');

router.use(authenticateToken, isAdmin);
router.get('/', asyncHandler(controller.list));
router.get('/verify', asyncHandler(controller.verify));
module.exports = router;
```
In `backend/routes/index.js` add the require near the others and `router.use('/audit', auditRoutes)`.
- [ ] **Step 4: Run** `cd backend && npx jest modules/audit/audit.controller.test.js` → PASS. Then `cd backend && npm test` (routes/index.js is a cross-cutting file — full suite must stay green).
- [ ] **Step 5: Commit** (`git add backend/modules/audit/audit.controller.js backend/modules/audit/audit.routes.js backend/modules/audit/audit.controller.test.js backend/routes/index.js`): `feat(audit): read-only admin audit viewer + chain-verify endpoint (Slice 7 Task 2)`

---

### Task 3: Admin role helper + gate + nav link

**Files:** Create `web/src/features/admin/{roles.ts,roles.test.ts}`, `web/src/features/admin/{AdminGate.tsx,AdminGate.test.tsx}`; Modify `web/app/(app)/layout.tsx`.

**Interfaces — Produces:**
- `roles.ts`: `roleLevel(role?: string): 0|1|2|3`; `isAdminRole(user: { role?: string } | null | undefined): boolean` (level>=2); `isSuperAdminRole(user): boolean` (level>=3). Mirror backend `utils/authz.js` LEVEL map exactly (incl. aliases `usuario/user/administrator/superadmin/super-admin`, case-insensitive).
- `AdminGate.tsx`: `export function AdminGate({ children }: { children: React.ReactNode })` — `'use client'`; reads `useCurrentUser()`; while loading shows nothing/spinner; if `!isAdminRole(data)` calls `router.replace('/dashboard')` and renders null; else renders `children`.

- [ ] **Step 1: Write the failing test** `roles.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { roleLevel, isAdminRole, isSuperAdminRole } from './roles';

describe('roles', () => {
  it('maps the backend hierarchy incl. aliases (case-insensitive)', () => {
    expect(roleLevel('normal')).toBe(1);
    expect(roleLevel('Usuario')).toBe(1);
    expect(roleLevel('admin')).toBe(2);
    expect(roleLevel('administrator')).toBe(2);
    expect(roleLevel('SUPER_ADMIN')).toBe(3);
    expect(roleLevel('super-admin')).toBe(3);
    expect(roleLevel(undefined)).toBe(0);
  });
  it('isAdminRole is level>=2, isSuperAdminRole is level>=3', () => {
    expect(isAdminRole({ role: 'admin' })).toBe(true);
    expect(isAdminRole({ role: 'normal' })).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isSuperAdminRole({ role: 'admin' })).toBe(false);
    expect(isSuperAdminRole({ role: 'super_admin' })).toBe(true);
  });
});
```
- [ ] **Step 2: Run** `cd web && npx vitest run src/features/admin/roles.test.ts` → FAIL.
- [ ] **Step 3: Implement** `roles.ts`:
```ts
const LEVEL: Record<string, 1 | 2 | 3> = {
  normal: 1, usuario: 1, user: 1,
  admin: 2, administrator: 2,
  super_admin: 3, superadmin: 3, 'super-admin': 3,
};
export function roleLevel(role?: string): 0 | 1 | 2 | 3 {
  return (LEVEL[String(role ?? '').toLowerCase()] ?? 0) as 0 | 1 | 2 | 3;
}
export function isAdminRole(user?: { role?: string } | null): boolean {
  return roleLevel(user?.role) >= 2;
}
export function isSuperAdminRole(user?: { role?: string } | null): boolean {
  return roleLevel(user?.role) >= 3;
}
```
Then `AdminGate.tsx` (`'use client'`, `useCurrentUser` + `useRouter`; redirect in a `useEffect` when loaded & not admin). Write `AdminGate.test.tsx`: admin role renders children; non-admin triggers `router.replace('/dashboard')` and renders null (mock `useCurrentUser` + `next/navigation`).
- [ ] **Step 4:** Modify `web/app/(app)/layout.tsx` — import `useCurrentUser` + `isAdminRole`; render the admin link conditionally: `{isAdminRole(user) && <Link href="/admin">{t('nav.admin')}</Link>}` (where `const { data: user } = useCurrentUser();`). Run `cd web && npx vitest run src/features/admin` → PASS; `cd web && npx tsc --noEmit`.
- [ ] **Step 5: Commit** (`git add web/src/features/admin/roles.ts web/src/features/admin/roles.test.ts web/src/features/admin/AdminGate.tsx web/src/features/admin/AdminGate.test.tsx "web/app/(app)/layout.tsx"`): `feat(web): admin role helper + least-privilege gate + nav link (Slice 7 Task 3)`

---

### Task 4: Types + API client

**Files:** Create `web/src/features/admin/{types.ts,api.ts,api.test.ts}`.

**Interfaces — Produces:**
- `types.ts`:
  - `PendingAction = { id: string; actionType: string; payload: Record<string, unknown>; amountUsd: string | null; status: 'pending'|'approved'|'rejected'|'expired'|'executed'|'failed'; makerUserId: string; checkerUserId: string | null; rejectionReason: string | null; result: Record<string, unknown> | null; expiresAt: string; resolvedAt: string | null; created_at: string }`
  - `PendingActionsResponse = { pending: PendingAction[] }`
  - `ApproveRequest = { codigo: string }`; `RejectRequest = { reason?: string }`
  - `OperatorSummary = { id: string; email: string; role: string; active: boolean; totpEnabled: boolean; twoFactorEnabled: boolean }`
  - `MfaReadiness = { ready: boolean; operatorCount: number; enrolledCount: number; minEnrolled: number; enrolled: OperatorSummary[]; pending: OperatorSummary[]; reasons: string[] }`
  - `BusinessConfigItem = { key: string; value: string; type?: string; category?: string | null; description?: string | null }`; `BusinessConfigResponse = { data: BusinessConfigItem[] }`; `ConfigUpsertRequest = { value: string; type?: 'string'|'number'|'boolean'|'json'; category?: string; description?: string }`
  - `AmlConfig = { monitoringEnabled: boolean; holdEnforcementEnabled: boolean }`
  - `DenylistAddress = { id: string; address: string; network: string; reason?: string | null; source?: string | null }`; `DenylistAddRequest = { address: string; network: string; reason?: string; source?: string }`
  - `AmlCase = { id: string; status: string; signalId?: string; evidence?: Record<string, unknown>; created_at?: string }`; `ResolveCaseRequest = { decision: 'approve' | 'reject' }`
  - `AdminUser = { id: string; username: string; email: string; role: string; active: boolean; kycVerified?: boolean; kycLevel?: string; dailyLimit?: string }` (superset projection; only fields the panel reads)
  - `AuditRow = { id: number; eventId: string; eventType: string; payload: Record<string, unknown>; aggregateId: string | null; occurredAt: string; prevHash: string | null; hash: string; created_at: string }`; `AuditListResponse = { rows: AuditRow[]; nextBeforeId: number | null }`; `AuditVerifyResult = { ok: boolean; brokenAtSeq: number | null; checked: number }`
- `adminApi` (Step 3).

- [ ] **Step 1: Write the failing test** `api.test.ts` — mock `apiClient`; assert EXACT paths + body field names (mirror the S6 `api.test.ts` structure):
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/shared/api';
import { adminApi } from './api';

vi.mock('@/shared/api', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
const m = apiClient as unknown as Record<string, ReturnType<typeof vi.fn>>;
beforeEach(() => vi.clearAllMocks());

describe('adminApi', () => {
  it('governance: pending/readiness/approve(codigo)/reject(reason)', async () => {
    m.get.mockResolvedValue({ pending: [] });
    await adminApi.getPending();
    expect(m.get).toHaveBeenCalledWith('/governance/pending');
    await adminApi.getReadiness();
    expect(m.get).toHaveBeenCalledWith('/governance/readiness');
    m.post.mockResolvedValue({});
    await adminApi.approveAction('id1', { codigo: '123456' });
    expect(m.post).toHaveBeenCalledWith('/governance/id1/approve', { codigo: '123456' });
    await adminApi.rejectAction('id1', { reason: 'nope' });
    expect(m.post).toHaveBeenCalledWith('/governance/id1/reject', { reason: 'nope' });
  });
  it('config: list / upsert', async () => {
    m.get.mockResolvedValue({ data: [] });
    await adminApi.getConfig('fees');
    expect(m.get).toHaveBeenCalledWith('/config?category=fees');
    m.put.mockResolvedValue({ data: {} });
    await adminApi.upsertConfig('swap.fee_bps', { value: '30', type: 'number' });
    expect(m.put).toHaveBeenCalledWith('/config/swap.fee_bps', { value: '30', type: 'number' });
  });
  it('aml: config/denylist/cases', async () => {
    m.get.mockResolvedValue({});
    await adminApi.getAmlConfig();
    expect(m.get).toHaveBeenCalledWith('/aml/config');
    m.put.mockResolvedValue({});
    await adminApi.setAmlConfig('aml.monitoring_enabled', 'true');
    expect(m.put).toHaveBeenCalledWith('/aml/config/aml.monitoring_enabled', { value: 'true' });
    m.post.mockResolvedValue({});
    await adminApi.addDenylist({ address: '0xabc', network: 'ETH' });
    expect(m.post).toHaveBeenCalledWith('/aml/denylist', { address: '0xabc', network: 'ETH' });
    m.delete.mockResolvedValue({});
    await adminApi.removeDenylist('d1');
    expect(m.delete).toHaveBeenCalledWith('/aml/denylist/d1');
    m.get.mockResolvedValue([]);
    await adminApi.getCases('open');
    expect(m.get).toHaveBeenCalledWith('/aml/cases?status=open');
    m.put.mockResolvedValue({});
    await adminApi.resolveCase('c1', { decision: 'approve' });
    expect(m.put).toHaveBeenCalledWith('/aml/cases/c1/resolve', { decision: 'approve' });
  });
  it('users: list/search + privileged mutations route to exact paths', async () => {
    m.get.mockResolvedValue([]);
    await adminApi.listUsers();
    expect(m.get).toHaveBeenCalledWith('/user');
    await adminApi.searchUsers('a@b.co');
    expect(m.get).toHaveBeenCalledWith('/user/search?q=a%40b.co');
  });
  it('audit: list with query + verify', async () => {
    m.get.mockResolvedValue({ rows: [], nextBeforeId: null });
    await adminApi.getAudit({ eventType: 'x', limit: 25 });
    expect(m.get).toHaveBeenCalledWith('/audit?eventType=x&limit=25');
    m.get.mockResolvedValue({ ok: true });
    await adminApi.verifyAudit();
    expect(m.get).toHaveBeenCalledWith('/audit/verify');
  });
});
```
- [ ] **Step 2: Run** `cd web && npx vitest run src/features/admin/api.test.ts` → FAIL.
- [ ] **Step 3: Implement** `types.ts` then `api.ts`. User-admin mutation methods (`updateUserStatus`, `updateUserRole`, `updateUserKyc`, `updateUserDailyLimit`, `updateUserReputation`, `deleteUser`, `getUserStats`) are declared here as thin `patch/delete/get` wrappers but their **request bodies are finalized in Task 7** after reading `user.controller.js`; for now type them with a generic `body: Record<string, unknown>`. `getAudit` builds the query string from only the provided keys (`eventType`, `aggregateId`, `limit`, `beforeId`). `getConfig(category?)` appends `?category=` only when provided. Use `encodeURIComponent` for `searchUsers` q.
- [ ] **Step 4: Run** → PASS; `cd web && npx tsc --noEmit`.
- [ ] **Step 5: Commit** (`git add web/src/features/admin/types.ts web/src/features/admin/api.ts web/src/features/admin/api.test.ts`): `feat(web): admin api client + types (Slice 7 Task 4)`

---

### Task 5: Query hooks + mutations

**Files:** Create `web/src/features/admin/{queries.ts,queries.test.tsx}`.

**Interfaces — Produces:** keys `ADMIN_PENDING_KEY`, `ADMIN_READINESS_KEY`, `ADMIN_CONFIG_KEY`, `ADMIN_AML_CONFIG_KEY`, `ADMIN_DENYLIST_KEY`, `ADMIN_CASES_KEY`, `ADMIN_USERS_KEY`, `ADMIN_AUDIT_KEY`; queries `usePending()`, `useReadiness()`, `useConfig(category?)`, `useAmlConfig()`, `useDenylist()`, `useCases(status?)`, `useUsers()`, `useAudit(params)`, `useAuditVerify()`; mutations `useApproveAction()`, `useRejectAction()`, `useUpsertConfig()`, `useSetAmlConfig()`, `useAddDenylist()`, `useRemoveDenylist()`, `useResolveCase()`, plus the user-admin mutations (finalized Task 7). All `useQuery<T, ApiError>` / `useMutation<_, ApiError, _>` with `retry: false`. On success each mutation invalidates its list key (approve/reject → `ADMIN_PENDING_KEY`; config → `ADMIN_CONFIG_KEY`; aml → the aml keys; resolve → `ADMIN_CASES_KEY`).

- [ ] **Step 1: Write the failing test** `queries.test.tsx` — mock `./api`; assert `usePending` fetches; `useApproveAction` calls `adminApi.approveAction(id, {codigo})` and invalidates `ADMIN_PENDING_KEY`; `useResolveCase` invalidates `ADMIN_CASES_KEY`. Mirror `web/src/features/profile/queries.test.tsx` wrapper.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `queries.ts` (`'use client'`) mirroring `web/src/features/profile/queries.ts`. Mutations take `{ id, body }`-style args where a path param is needed (e.g. `useApproveAction().mutate({ id, codigo })`).
- [ ] **Step 4: Run** → PASS; tsc.
- [ ] **Step 5: Commit** (`git add web/src/features/admin/queries.ts web/src/features/admin/queries.test.tsx`): `feat(web): admin query hooks + mutations (Slice 7 Task 5)`

---

### Task 6: i18n keys (en/es) + parity test

**Files:** Modify `web/src/shared/i18n/catalogs/{en,es}.ts`; Create `web/src/features/admin/i18nAdminKeys.test.ts`.

The `ui` block is a FLAT object of dotted string keys. Add an `admin.*` namespace + `nav.admin` to BOTH catalogs (English + rioplatense Spanish). Cover: tabs (`admin.tab.{governance|users|config|aml|audit}`), `nav.admin`; governance (pending empty, action-type label, maker/created/expires labels, amountUsd label, approve CTA, TOTP-code label + hint, reject CTA + reason label, success/denied); readiness (ready/not-ready badge, operatorCount/enrolledCount/minEnrolled labels, reasons heading, enrolled/pending lists); users (search placeholder, list columns, status toggle, kyc update, daily-limit, reputation, **super-admin-only** role change + delete labels, confirm-delete dialog, stats); config (list columns, key/value/type/category/description labels, save, saved, invalid advisory); aml (monitoring/hold toggles, denylist add form labels + list, remove, cases list + status filter, resolve approve/reject, already-resolved note); audit (columns event-type/aggregate/occurred/hash, verify CTA, verify-ok/verify-broken badge, load-more, filter-by-event-type).

- [ ] **Step 1: Write the failing parity test** (flat shape — filter `cat.ui` keys starting with `'admin.'`, assert en==es set + non-empty). Mirror `web/src/features/profile/i18nProfileKeys.test.ts`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Add the keys** to both catalogs.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** (`git add web/src/shared/i18n/catalogs/en.ts web/src/shared/i18n/catalogs/es.ts web/src/features/admin/i18nAdminKeys.test.ts`): `feat(web): admin i18n keys (en/es) + parity test (Slice 7 Task 6)`

---

### Task 7: UsersAdmin feature finalization + component (least-privilege)

**Files:** Modify `web/src/features/admin/{api.ts,queries.ts}` (lock user-mutation bodies); Create `web/src/features/admin/components/{UsersAdmin.tsx,UsersAdmin.test.tsx}`.

**FIRST — lock the contract:** open `backend/modules/users/user.controller.js` and read `updateUsuarioStatus`, `updateUsuarioRole`, `updateUsuarioKYC`, `updateDailyLimit`, `updateUsuarioReputation`, `getUsuarios`, `getUsuariosStats`. Record the EXACT request-body field names and the list/stats response shapes in the contract doc (Task 13) and type the `adminApi` user methods + `AdminUser` accordingly. Do NOT guess — the route file names the handler, the controller names the fields.

**Interfaces — Consumes:** `useUsers()`, `useCurrentUser()`, the user-admin mutations, `isSuperAdminRole` (Task 3), `useTranslation`, `useErrorTranslation`, `Field`, `Button`, `Dialog`.
**Produces:** `export function UsersAdmin()`.

Behavior: a search box (`searchUsers`) + the user list (`useUsers`); each row shows username/email/role/active/kyc. Admin (level 2) can: toggle status, update KYC, set daily-limit, set reputation. **Super-admin-only (level 3):** change role + delete user — these controls are **not rendered at all** for level 2 (read `isSuperAdminRole(useCurrentUser().data)`; do not merely disable). Delete is behind a confirm `Dialog`. A stats panel (`getUserStats`). All mutations `retry:false`, disabled-while-pending, errors via `tError`.

- [ ] **Step 1: Failing test** `UsersAdmin.test.tsx` — with a super-admin current user, the role-change + delete controls render; with a plain-admin current user they are ABSENT (`queryByText` null); a status toggle calls the mutation; delete opens the Dialog and confirming calls `deleteUser(id)`. Mock the hooks + `useCurrentUser` + i18n.
- [ ] **Step 2–4:** RED → implement → GREEN; `cd web && npx tsc --noEmit`.
- [ ] **Step 5: Commit** (explicit add of the 4 touched files): `feat(web): admin user management with super-admin-gated actions (Slice 7 Task 7)`

---

### Task 8: GovernanceInbox (coordinator-reviewed)

**Files:** Create `web/src/features/admin/components/{GovernanceInbox.tsx,GovernanceInbox.test.tsx,admin.module.css}`.

**Interfaces:** `usePending()`, `useApproveAction()`, `useRejectAction()`, `useTranslation`, `useErrorTranslation`, `Field`, `Button`, `Dialog`.
**Produces:** `export function GovernanceInbox()`.

Behavior: list pending actions (`actionType`, `amountUsd` rendered verbatim as a decimal string when present, maker, created/expires). Each row has **Approve** and **Reject**:
- **Approve** opens a `Dialog` requiring the checker's TOTP `codigo` (type=text, numeric inputmode, no autocomplete) → `useApproveAction().mutate({ id, codigo })`. The dialog states the 4-eyes rule (a distinct operator must approve) from i18n. On success the dialog closes and the list invalidates (pending → gone).
- **Reject** opens a `Dialog` with an optional `reason` → `useRejectAction().mutate({ id, reason })`.
- Buttons disabled-while-pending; a bad/replayed TOTP (401) or maker===checker / already-resolved typed 4xx surfaces via `tError(code, { requestId })`. The `codigo` lives only in component state. Empty/loading/error states.

- [ ] **Step 1: Failing test** — renders a pending row; Approve opens the dialog, entering a code and confirming calls `approveAction({ id, codigo })`; Reject sends `{ id, reason }`; a 401 bad-code error renders; empty state when no pending. Mock hooks + i18n.
- [ ] **Step 2–4:** RED → implement → GREEN; tsc.
- [ ] **Step 5: Commit:** `feat(web): maker-checker governance inbox with TOTP approve (Slice 7 Task 8)`

---

### Task 9: BusinessConfigEditor (coordinator-reviewed)

**Files:** Create `web/src/features/admin/components/{BusinessConfigEditor.tsx,BusinessConfigEditor.test.tsx}`.

**FIRST:** confirm `BusinessConfig` entity fields in `backend/modules/config/businessConfig.entity.js` and record in the contract doc.

**Interfaces:** `useConfig(category?)`, `useUpsertConfig()`, `useTranslation`, `useErrorTranslation`, `Field`, `Button`.
**Produces:** `export function BusinessConfigEditor()`.

Behavior: optional category filter (select/text) → `useConfig(category)`; a table of `{ key, value, type, category, description }`. An inline edit per row (or an edit `Dialog`) that sends `useUpsertConfig().mutate({ key, body: { value, type, category, description } })`. Client advisory: non-empty value; `type` ∈ {string,number,boolean,json}. The backend's `400 CONFIG_INVALID_INPUT` surfaces via `tError`. **Values are rendered/edited as strings** (the backend persists string + a type tag — never coerce with `parseFloat`). Disabled-while-pending; success/error.

- [ ] **Step 1: Failing test** — renders a config row; editing the value + saving calls `upsertConfig` with `{ key, body:{ value, type } }`; an invalid-input error renders; category filter passes the arg to `useConfig`. Mock hooks + i18n.
- [ ] **Step 2–4:** RED → implement → GREEN; tsc.
- [ ] **Step 5: Commit:** `feat(web): business-config editor (Slice 7 Task 9)`

---

### Task 10: AmlOps (coordinator-reviewed)

**Files:** Create `web/src/features/admin/components/{AmlOps.tsx,AmlOps.test.tsx}`.

**Interfaces:** `useAmlConfig()`, `useSetAmlConfig()`, `useDenylist()`, `useAddDenylist()`, `useRemoveDenylist()`, `useCases(status?)`, `useResolveCase()`, `useTranslation`, `useErrorTranslation`, `Field`, `Button`, `Dialog`.
**Produces:** `export function AmlOps()`.

Behavior, three sub-sections:
- **Config toggles:** show `monitoringEnabled` + `holdEnforcementEnabled`; each toggle → `useSetAmlConfig().mutate({ key, value })` where key is the full `aml.*` key and value is `'true'|'false'` (string). (Confirm the exact keys `aml.monitoring_enabled` / `aml.hold_enforcement_enabled` against `amlConfig.js` in Task 13.)
- **Denylist:** add form (`address`, `network`, optional `reason`/`source`) → `useAddDenylist()`; list with a remove button → `useRemoveDenylist(id)`.
- **Cases:** status filter → `useCases(status)`; each case shows id/status/signal; a resolve control → `useResolveCase().mutate({ id, decision })` with `decision: 'approve'|'reject'` behind a confirm `Dialog` that states approve releases a held S5 withdrawal / reject refunds it. A `409 already-resolved` surfaces via `tError`. **Tipping-off:** case data stays inside the admin panel only.
- All mutations `retry:false`, disabled-while-pending, errors via `tError`.

- [ ] **Step 1: Failing test** — toggling monitoring calls `setAmlConfig({ key:'aml.monitoring_enabled', value:'false' })`; adding a denylist entry sends `{ address, network }`; resolving a case opens the Dialog and confirming sends `{ id, decision:'approve' }`; a 409 error renders. Mock hooks + i18n.
- [ ] **Step 2–4:** RED → implement → GREEN; tsc.
- [ ] **Step 5: Commit:** `feat(web): AML ops (config/denylist/cases) admin surface (Slice 7 Task 10)`

---

### Task 11: OperatorReadinessCard + AuditViewer

**Files:** Create `web/src/features/admin/components/{OperatorReadinessCard.tsx,OperatorReadinessCard.test.tsx,AuditViewer.tsx,AuditViewer.test.tsx}`.

**OperatorReadinessCard — Interfaces:** `useReadiness()`, `useTranslation`. **Produces:** `export function OperatorReadinessCard()`.
Behavior: a prominent **READY / NOT READY** badge (`ready`), `enrolledCount`/`minEnrolled`/`operatorCount`, the `reasons[]` list when not ready, and the `enrolled`/`pending` operator emails+roles (non-sensitive summary fields only). This is the go-live gate #5 visibility surface. Loading/error states.

**AuditViewer — Interfaces:** `useAudit(params)`, `useAuditVerify()`, `useTranslation`. **Produces:** `export function AuditViewer()`.
Behavior: an optional `eventType` filter; a table of rows (`eventType`, `aggregateId`, `occurredAt` via `toLocaleString(locale)`, short `hash`); a **Verify chain** button → `useAuditVerify()` showing an OK badge or a "broken at seq N" warning; a **Load more** button using `nextBeforeId` as the cursor (accumulate rows in component state or refetch with the new `beforeId`). Read-only — no mutations. Loading/empty/error states.

- [ ] **Step 1: Failing tests** — readiness: not-ready renders the badge + reasons; ready renders READY + counts. audit: rows render; Verify shows OK vs broken; Load-more uses `nextBeforeId`. Mock hooks + i18n.
- [ ] **Step 2–4:** RED → implement → GREEN; tsc.
- [ ] **Step 5: Commit:** `feat(web): operator-readiness card + read-only audit viewer (Slice 7 Task 11)`

---

### Task 12: Admin tabs shell + route + barrel + nav wiring

**Files:** Create `web/src/features/admin/components/{AdminTabs.tsx,AdminTabs.test.tsx}`, `web/src/features/admin/index.ts`, `web/app/(app)/admin/page.tsx`.

**IMPORTANT paths:** the App Router lives in `web/app/` (NOT `web/src/app/`). Mirror `web/app/(app)/profile/page.tsx`. The nav link was added in Task 3.

**Produces:** `AdminPage` (from the barrel). A 5-tab shell (`role="tablist"`) over: **Governance** (`GovernanceInbox` + `OperatorReadinessCard` stacked), **Users** (`UsersAdmin`), **Config** (`BusinessConfigEditor`), **AML** (`AmlOps`), **Audit** (`AuditViewer`). `page.tsx` wraps it in the gate: `import { AdminGate } from '@/features/admin/AdminGate'; import { AdminPage } from '@/features/admin'; export default function Page(){ return <AdminGate><AdminPage/></AdminGate>; }`.

- [ ] **Step 1: Failing test** `AdminTabs.test.tsx` — 5 tab labels render; clicking switches panels (mock child components to stubs + i18n).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `AdminTabs` (`'use client'`, mirror `web/src/features/profile/components/ProfileTabs.tsx`), barrel (`export { AdminPage } from './components/AdminTabs'`), and `page.tsx`.
- [ ] **Step 4: Run** `cd web && npx vitest run src/features/admin` → PASS; then `cd web && npx tsc --noEmit` and `cd web && npm run build` (confirm `/admin`).
- [ ] **Step 5: Commit** (explicit add of the 4 files): `feat(web): admin page shell, tabs, route + gate wiring (Slice 7 Task 12)`

---

### Task 13: Contract doc §23 + final slice gate

**Files:** Modify `docs/frontend-rebuild/backend-contract-changes.md` (add §23).

- [ ] **Step 1:** Add **§23 — Next.js `web/` app — admin endpoints consumed (Slice 7, 2026-10-13)** documenting: the least-privilege role model (level 2 vs 3, which actions are super-admin-only); governance pending/approve(TOTP `codigo`)/reject(`reason`) + the **new** `GET /governance/readiness`; business-config list/upsert (value-as-string + type tag); AML config/denylist/cases + the exact `aml.*` keys confirmed from `amlConfig.js`; the user-admin PATCH body field names **locked from `user.controller.js`** in Task 7; and the **two new backend endpoints** (`GET /governance/readiness`, `GET /audit` + `GET /audit/verify`) with their response shapes. Note `audit` read endpoints are `isAdmin`-only (read-only, no operator-MFA) while all writes keep `isAdmin + requireOperatorMFA`.
- [ ] **Step 2: Full gate:**
  - Backend: `cd backend && npm test` (Tasks 1–2 green within the full suite).
  - Frontend: `cd web && npx tsc --noEmit && npx vitest run && npm run build` — tsc 0; all Vitest green (prior 427 + the new admin tests); `/admin` route present in the build output.
- [ ] **Step 3: Commit:** `docs: admin contract §23 + Slice 7 gate (Slice 7 Task 13)`

---

## Self-Review

**Spec coverage** (design spec S7 line + handoff "routing de menor-privilegio, MFA de operadores, config de negocio editable, ops AML/KYC/audit"):
- Least-privilege routing → Task 3 (role helper + gate + conditional nav) enforced again inside Task 7 (super-only user actions) and Task 12 (gate wraps the page).
- Operator MFA state → Task 1 (backend endpoint) + Task 11 (readiness card) — directly feeds go-live gate #5.
- Business config editable → Tasks 4/5/9.
- AML ops → Tasks 4/5/10. **KYC admin** = the per-user `PATCH /user/:id/kyc` inside Task 7 user management (there is no separate admin-KYC surface; `/kyc/status` is user-facing and already consumed in S6). Audit ops → Task 2 (backend) + Task 11 (viewer).
- Governance Maker-Checker inbox (the privileged crown jewel) → Tasks 4/5/8.
- **Explicitly OUT of scope** (documented, not in the handoff's S7 list): legacy admin "setup/seed" ops (wallet init, exchange-pair generation, crypto-icon generation, direct admin balance update) — admin balance mutations already route through Maker-Checker and appear in the governance inbox; the seed ops are deploy/bootstrap tooling, not panel features. fr/it/pt locales. A generic governance "propose" form (propose is service-driven).

**Placeholder scan:** backend Tasks 1–2 and the governance-approve path carry full code + tests; privileged/display components (7–11) give exact interfaces + behavior + representative tests and name the files to mirror (profile forms, P2PTabs, wallet views). User-admin bodies and `BusinessConfig`/`aml.*` keys are NOT invented — each is an explicit "read the controller/entity and lock it" step (Tasks 7, 9, 10, 13).

**Type consistency:** `PendingAction`/`MfaReadiness`/`BusinessConfigItem`/`AmlConfig`/`DenylistAddress`/`AmlCase`/`AdminUser`/`AuditRow` defined in Task 4 and consumed unchanged in 5–12. Wire body names (`codigo`, `reason`, `value`, `address`/`network`, `decision`) are the backend's exact names, asserted in Task 4's test. Role hierarchy map is defined once (Task 3 `roles.ts`) and reused by the gate, the nav link, and the super-only user actions.

**Security/least-privilege check:** `/admin` nav link hidden for level<2 (Task 3) AND the page redirects level<2 (AdminGate, Tasks 3/12) — defence in depth, matching the backend's per-route `isAdmin`/`isSuperAdmin`. Super-admin-only actions are not rendered (not merely disabled) for level 2 (Task 7). Governance approve requires a TOTP `codigo` held only in component state; reject reason likewise. AML case data never leaves the admin panel (tipping-off). Audit viewer is strictly read-only and the new endpoint never mutates the hash chain. `amountUsd` and config values are treated as decimal strings — no `parseFloat` anywhere. All mutations are `retry:false` + disabled-while-pending. Backend write endpoints keep `isAdmin + requireOperatorMFA`; only the two NEW read endpoints are added, both reusing already-tested pure logic (`assessMfaReadiness`, `verifyAuditChain`).
