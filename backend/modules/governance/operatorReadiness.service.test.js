const svc = require('./operatorReadiness.service');

// An operator counts as MFA-enrolled only when BOTH flags are true: `totpEnabled`
// (so `totp.verifyForUser` can validate the checker's second factor) AND
// `twoFactorEnabled` (so `requireOperatorMFA` lets them reach the approve route).
function op(overrides = {}) {
  return {
    id: overrides.id || 'op-1',
    email: overrides.email || 'op@exchange.test',
    role: overrides.role || 'admin',
    active: true,
    totpEnabled: true,
    twoFactorEnabled: true,
    ...overrides,
  };
}

describe('operatorReadiness.assessMfaReadiness — dual-control deploy gate', () => {
  test('two fully-enrolled operators → ready (maker≠checker is satisfiable)', () => {
    const r = svc.assessMfaReadiness([op({ id: 'a' }), op({ id: 'b' })]);
    expect(r.ready).toBe(true);
    expect(r.enrolledCount).toBe(2);
    expect(r.operatorCount).toBe(2);
    expect(r.reasons).toEqual([]);
  });

  test('single enrolled operator → NOT ready (no distinct checker possible)', () => {
    const r = svc.assessMfaReadiness([op({ id: 'a' })]);
    expect(r.ready).toBe(false);
    expect(r.enrolledCount).toBe(1);
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  test('no operators at all → NOT ready, with an explicit reason', () => {
    const r = svc.assessMfaReadiness([]);
    expect(r.ready).toBe(false);
    expect(r.operatorCount).toBe(0);
    expect(r.reasons.join(' ')).toMatch(/operador/i);
  });

  test('totpEnabled but twoFactorEnabled=false does NOT count as enrolled', () => {
    // Would pass totp.verifyForUser but be blocked by requireOperatorMFA → cannot approve.
    const r = svc.assessMfaReadiness([
      op({ id: 'a' }),
      op({ id: 'b', twoFactorEnabled: false }),
    ]);
    expect(r.enrolledCount).toBe(1);
    expect(r.ready).toBe(false);
    expect(r.pending.map((o) => o.id)).toContain('b');
  });

  test('twoFactorEnabled but totpEnabled=false does NOT count as enrolled', () => {
    // Would pass requireOperatorMFA but totp.verifyForUser throws TOTP_NOT_ENABLED.
    const r = svc.assessMfaReadiness([
      op({ id: 'a' }),
      op({ id: 'b', totpEnabled: false }),
    ]);
    expect(r.enrolledCount).toBe(1);
    expect(r.ready).toBe(false);
  });

  test('minEnrolled is configurable (e.g. a stricter 3-eyes posture)', () => {
    const r = svc.assessMfaReadiness([op({ id: 'a' }), op({ id: 'b' })], { minEnrolled: 3 });
    expect(r.minEnrolled).toBe(3);
    expect(r.ready).toBe(false);
  });

  test('a DEACTIVATED enrolled operator does NOT count (cannot authenticate to approve)', () => {
    // authenticateToken 401s inactive users, so an inactive operator can never be a checker.
    const r = svc.assessMfaReadiness([op({ id: 'a' }), op({ id: 'b', active: false })]);
    expect(r.enrolledCount).toBe(1);
    expect(r.ready).toBe(false);
    expect(r.pending.map((o) => o.id)).toContain('b');
  });

  test('a nonsensical minEnrolled (< 1 or non-integer) fails closed to the default, not fail-open', () => {
    // A negative env-derived value must NOT make `enrolledCount < min` never true.
    const none = svc.assessMfaReadiness([], { minEnrolled: -1 });
    expect(none.minEnrolled).toBe(svc.DEFAULT_MIN_ENROLLED);
    expect(none.ready).toBe(false);
    const one = svc.assessMfaReadiness([op({ id: 'a' })], { minEnrolled: 0 });
    expect(one.minEnrolled).toBe(svc.DEFAULT_MIN_ENROLLED);
    expect(one.ready).toBe(false);
  });

  test('enrolled/pending summaries never leak secret material', () => {
    const r = svc.assessMfaReadiness([op({ id: 'a', totpSecret: 'SUPERSECRET', password: 'x' })]);
    const serialized = JSON.stringify(r);
    expect(serialized).not.toMatch(/SUPERSECRET/);
    expect(serialized).not.toMatch(/totpSecret/i);
    expect(serialized).not.toMatch(/password/i);
  });

  test('non-array input is tolerated (treated as empty)', () => {
    const r = svc.assessMfaReadiness(null);
    expect(r.ready).toBe(false);
    expect(r.operatorCount).toBe(0);
  });
});
