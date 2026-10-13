// web/src/features/admin/components/AuditViewer.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';
import { AuditViewer } from './AuditViewer';

// ── Hoisted mock fns ──────────────────────────────────────────────────────────

const mutateVerify = vi.fn();
const useAuditMock = vi.fn();
const useAuditVerifyMock = vi.fn();

vi.mock('../queries', () => ({
  useAudit: (params: unknown) => useAuditMock(params),
  useAuditVerify: () => useAuditVerifyMock(),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_ROW = {
  id: 1,
  eventId: 'evt-abc123',
  eventType: 'WITHDRAWAL_CREATED',
  payload: {},
  aggregateId: 'agg-xyz-999',
  occurredAt: '2026-10-13T10:00:00Z',
  prevHash: null,
  hash: 'abcdef1234567890deadbeef',
  created_at: '2026-10-13T10:00:00Z',
};

function makeVerifyMock(
  mutFn: ReturnType<typeof vi.fn>,
  options?: { isPending?: boolean; isSuccess?: boolean; data?: unknown },
) {
  return {
    mutate: mutFn,
    isPending: options?.isPending ?? false,
    isSuccess: options?.isSuccess ?? false,
    data: options?.data ?? undefined,
  };
}

function defaultSetup() {
  useAuditMock.mockReturnValue({
    data: { rows: [MOCK_ROW], nextBeforeId: null },
    isLoading: false,
    isError: false,
  });
  useAuditVerifyMock.mockReturnValue(makeVerifyMock(mutateVerify));
}

beforeEach(() => {
  vi.clearAllMocks();
  defaultSetup();
});

function setup() {
  return render(
    <LocaleProvider>
      <AuditViewer />
    </LocaleProvider>,
  );
}

// ── Loading / error / empty ───────────────────────────────────────────────────

describe('AuditViewer — loading state', () => {
  it('shows loading indicator while isLoading', () => {
    useAuditMock.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    setup();
    expect(screen.getByText(/Loading\.\.\./i)).toBeInTheDocument();
  });
});

describe('AuditViewer — error state', () => {
  it('shows error alert when isError', () => {
    useAuditMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    setup();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('AuditViewer — empty state', () => {
  it('shows empty message when rows is empty', () => {
    useAuditMock.mockReturnValue({
      data: { rows: [], nextBeforeId: null },
      isLoading: false,
      isError: false,
    });
    setup();
    // No table rows visible — just verify no eventType cell from our fixture
    expect(screen.queryByText('WITHDRAWAL_CREATED')).not.toBeInTheDocument();
  });
});

// ── Row rendering ─────────────────────────────────────────────────────────────

describe('AuditViewer — row rendering', () => {
  it('renders the eventType in the table', () => {
    setup();
    expect(screen.getByText('WITHDRAWAL_CREATED')).toBeInTheDocument();
  });

  it('renders the aggregateId', () => {
    setup();
    expect(screen.getByText('agg-xyz-999')).toBeInTheDocument();
  });

  it('renders a short hash (first 12 chars of the hash)', () => {
    setup();
    // hash = 'abcdef1234567890deadbeef' → first 12 = 'abcdef123456'
    expect(screen.getByText('abcdef123456')).toBeInTheDocument();
  });

  it('renders the column headings', () => {
    setup();
    // admin.audit.col.eventType = "Event type" — also appears in filter label, use getAllByText
    const eventTypeCells = screen.getAllByText(/Event type/i);
    expect(eventTypeCells.length).toBeGreaterThanOrEqual(1);
    // admin.audit.col.aggregate = "Aggregate"
    expect(screen.getByText(/^Aggregate$/i)).toBeInTheDocument();
    // admin.audit.col.occurred = "Occurred at"
    expect(screen.getByText(/Occurred at/i)).toBeInTheDocument();
    // admin.audit.col.hash = "Hash"
    expect(screen.getByText(/^Hash$/i)).toBeInTheDocument();
  });
});

// ── Verify chain ──────────────────────────────────────────────────────────────

describe('AuditViewer — Verify chain button', () => {
  it('clicking Verify chain calls mutate', async () => {
    setup();
    // admin.audit.verify.cta = "Verify chain"
    fireEvent.click(screen.getByRole('button', { name: /Verify chain/i }));
    await waitFor(() => expect(mutateVerify).toHaveBeenCalled());
  });

  it('shows ok badge when verify result is ok=true', () => {
    useAuditVerifyMock.mockReturnValue(
      makeVerifyMock(mutateVerify, {
        isSuccess: true,
        data: { ok: true, brokenAtSeq: null, checked: 5 },
      }),
    );
    setup();
    // admin.audit.verify.ok = "Chain verified — no tampering detected."
    expect(screen.getByText(/Chain verified/i)).toBeInTheDocument();
  });

  it('shows broken message with seq when ok=false', () => {
    useAuditVerifyMock.mockReturnValue(
      makeVerifyMock(mutateVerify, {
        isSuccess: true,
        data: { ok: false, brokenAtSeq: 42, checked: 50 },
      }),
    );
    setup();
    // admin.audit.verify.broken = "Chain integrity broken at sequence {{seq}}."
    expect(screen.getByText(/Chain integrity broken at sequence 42/i)).toBeInTheDocument();
  });
});

// ── Load more ─────────────────────────────────────────────────────────────────

describe('AuditViewer — Load more', () => {
  it('does NOT show Load more when nextBeforeId is null', () => {
    setup(); // nextBeforeId: null by default
    // admin.audit.loadMore = "Load more"
    expect(screen.queryByRole('button', { name: /Load more/i })).not.toBeInTheDocument();
  });

  it('shows Load more when nextBeforeId is non-null', () => {
    useAuditMock.mockReturnValue({
      data: { rows: [MOCK_ROW], nextBeforeId: 99 },
      isLoading: false,
      isError: false,
    });
    setup();
    expect(screen.getByRole('button', { name: /Load more/i })).toBeInTheDocument();
  });

  it('clicking Load more causes useAudit to be called with the new beforeId', async () => {
    useAuditMock.mockReturnValue({
      data: { rows: [MOCK_ROW], nextBeforeId: 99 },
      isLoading: false,
      isError: false,
    });
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Load more/i }));
    await waitFor(() => {
      // The second call should have beforeId: 99 in the params
      const calls = useAuditMock.mock.calls;
      const hasBeforeId = calls.some(
        (callArgs) => callArgs[0] && callArgs[0].beforeId === 99,
      );
      expect(hasBeforeId).toBe(true);
    });
  });
});
