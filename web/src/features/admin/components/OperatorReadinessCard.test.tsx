// web/src/features/admin/components/OperatorReadinessCard.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';
import { OperatorReadinessCard } from './OperatorReadinessCard';

// ── Hoisted mock ──────────────────────────────────────────────────────────────

const useReadinessMock = vi.fn();

vi.mock('../queries', () => ({
  useReadiness: () => useReadinessMock(),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ENROLLED_OP = {
  id: 'op-1',
  email: 'alice@exchange.io',
  role: 'admin',
  active: true,
  totpEnabled: true,
  twoFactorEnabled: true,
};

const PENDING_OP = {
  id: 'op-2',
  email: 'bob@exchange.io',
  role: 'operator',
  active: true,
  totpEnabled: false,
  twoFactorEnabled: false,
};

const READINESS_NOT_READY = {
  ready: false,
  operatorCount: 2,
  enrolledCount: 1,
  minEnrolled: 2,
  enrolled: [ENROLLED_OP],
  pending: [PENDING_OP],
  reasons: ['Not enough operators have TOTP enrolled.'],
};

const READINESS_READY = {
  ready: true,
  operatorCount: 3,
  enrolledCount: 3,
  minEnrolled: 2,
  enrolled: [ENROLLED_OP],
  pending: [],
  reasons: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

function setup() {
  return render(
    <LocaleProvider>
      <OperatorReadinessCard />
    </LocaleProvider>,
  );
}

// ── Loading / error ───────────────────────────────────────────────────────────

describe('OperatorReadinessCard — loading state', () => {
  it('shows loading indicator while isLoading', () => {
    useReadinessMock.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    setup();
    expect(screen.getByText(/Loading\.\.\./i)).toBeInTheDocument();
  });
});

describe('OperatorReadinessCard — error state', () => {
  it('shows error message when isError', () => {
    useReadinessMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: {} });
    setup();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

// ── NOT READY ─────────────────────────────────────────────────────────────────

describe('OperatorReadinessCard — NOT ready', () => {
  beforeEach(() => {
    useReadinessMock.mockReturnValue({
      data: READINESS_NOT_READY,
      isLoading: false,
      isError: false,
    });
  });

  it('shows the NOT READY badge', () => {
    setup();
    // admin.readiness.notReady = "Not ready"
    expect(screen.getByText(/Not ready/i)).toBeInTheDocument();
  });

  it('does NOT show the READY badge', () => {
    setup();
    // admin.readiness.ready = "Ready"
    // "Not ready" also contains "ready" — so use exact match via role/data-testid or check for exact text
    const readyBadge = screen.queryByText(/^Ready$/i);
    expect(readyBadge).not.toBeInTheDocument();
  });

  it('shows the reasons list heading', () => {
    setup();
    // admin.readiness.reasons.heading = "Readiness issues"
    expect(screen.getByText(/Readiness issues/i)).toBeInTheDocument();
  });

  it('renders each reason text', () => {
    setup();
    expect(screen.getByText(/Not enough operators have TOTP enrolled\./i)).toBeInTheDocument();
  });

  it('shows enrolledCount and minEnrolled', () => {
    setup();
    // enrolledCount=1, operatorCount=2, minEnrolled=2
    // "2" appears twice (operatorCount + minEnrolled) — use getAllByText
    expect(screen.getByText('1')).toBeInTheDocument();
    const twos = screen.getAllByText('2');
    expect(twos.length).toBeGreaterThanOrEqual(2);
  });

  it('renders enrolled operator email', () => {
    setup();
    expect(screen.getByText('alice@exchange.io')).toBeInTheDocument();
  });

  it('renders pending operator email', () => {
    setup();
    expect(screen.getByText('bob@exchange.io')).toBeInTheDocument();
  });

  it('shows enrolled section heading', () => {
    setup();
    // admin.readiness.enrolled.heading = "Enrolled operators"
    // May appear in both enrolled section heading and aria labels — use getAllByText
    const headings = screen.getAllByText(/Enrolled operators/i);
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it('shows pending enrollment section heading', () => {
    setup();
    // admin.readiness.pending.heading = "Pending enrollment"
    expect(screen.getByText(/Pending enrollment/i)).toBeInTheDocument();
  });
});

// ── READY ─────────────────────────────────────────────────────────────────────

describe('OperatorReadinessCard — READY', () => {
  beforeEach(() => {
    useReadinessMock.mockReturnValue({
      data: READINESS_READY,
      isLoading: false,
      isError: false,
    });
  });

  it('shows the READY badge', () => {
    setup();
    // admin.readiness.ready = "Ready"
    expect(screen.getByText(/^Ready$/i)).toBeInTheDocument();
  });

  it('does NOT show the reasons list when ready', () => {
    setup();
    expect(screen.queryByText(/Readiness issues/i)).not.toBeInTheDocument();
  });

  it('shows operatorCount, enrolledCount, minEnrolled', () => {
    setup();
    // operatorCount=3, enrolledCount=3, minEnrolled=2
    // "3" appears twice (operatorCount + enrolledCount), "2" once (minEnrolled)
    const threes = screen.getAllByText('3');
    expect(threes.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders enrolled operator email', () => {
    setup();
    expect(screen.getByText('alice@exchange.io')).toBeInTheDocument();
  });

  it('does NOT show pending section when pending list is empty', () => {
    setup();
    expect(screen.queryByText(/Pending enrollment/i)).not.toBeInTheDocument();
  });
});
