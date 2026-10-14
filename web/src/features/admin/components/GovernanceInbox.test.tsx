// web/src/features/admin/components/GovernanceInbox.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';
import { GovernanceInbox } from './GovernanceInbox';

// ── Hoisted mock fns ──────────────────────────────────────────────────────────
const mutateApprove = vi.fn();
const mutateReject = vi.fn();

const usePendingMock = vi.fn();
const useApproveActionMock = vi.fn();
const useRejectActionMock = vi.fn();

vi.mock('../queries', () => ({
  usePending: () => usePendingMock(),
  useApproveAction: () => useApproveActionMock(),
  useRejectAction: () => useRejectActionMock(),
}));

// ── Fixture ───────────────────────────────────────────────────────────────────

const MOCK_ACTION = {
  id: 'action-1',
  actionType: 'withdrawal_approve',
  payload: {},
  amountUsd: '25000.00',
  status: 'pending' as const,
  makerUserId: 'maker-user-99',
  checkerUserId: null,
  rejectionReason: null,
  result: null,
  expiresAt: '2026-10-14T12:00:00Z',
  resolvedAt: null,
  created_at: '2026-10-13T10:00:00Z',
};

function makeMutationMock(
  mutateFn: ReturnType<typeof vi.fn>,
  options?: { isPending?: boolean; isError?: boolean; error?: unknown },
) {
  return {
    mutate: mutateFn,
    isPending: options?.isPending ?? false,
    isError: options?.isError ?? false,
    error: options?.error ?? null,
  };
}

function defaultSetup() {
  usePendingMock.mockReturnValue({
    data: { pending: [MOCK_ACTION] },
    isLoading: false,
    isError: false,
    error: null,
  });
  useApproveActionMock.mockReturnValue(makeMutationMock(mutateApprove));
  useRejectActionMock.mockReturnValue(makeMutationMock(mutateReject));
}

beforeEach(() => {
  vi.clearAllMocks();
  defaultSetup();
});

function setup() {
  return render(
    <LocaleProvider>
      <GovernanceInbox />
    </LocaleProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GovernanceInbox — row rendering', () => {
  it('renders a pending row with actionType', () => {
    setup();
    expect(screen.getByText('withdrawal_approve')).toBeInTheDocument();
  });

  it('renders amountUsd VERBATIM — no numeric coercion (exact string "25000.00")', () => {
    setup();
    // The string must appear as-is — never reformatted via parseFloat/toFixed
    expect(screen.getByText('25000.00')).toBeInTheDocument();
  });

  it('renders the makerUserId', () => {
    setup();
    expect(screen.getByText('maker-user-99')).toBeInTheDocument();
  });

  it('renders a dash when amountUsd is null', () => {
    usePendingMock.mockReturnValue({
      data: { pending: [{ ...MOCK_ACTION, amountUsd: null }] },
      isLoading: false,
      isError: false,
      error: null,
    });
    setup();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('GovernanceInbox — empty state', () => {
  it('renders the empty state when pending is []', () => {
    usePendingMock.mockReturnValue({
      data: { pending: [] },
      isLoading: false,
      isError: false,
      error: null,
    });
    setup();
    // admin.governance.pending.empty = "No pending actions."
    expect(screen.getByText(/No pending actions\./i)).toBeInTheDocument();
  });
});

describe('GovernanceInbox — loading state', () => {
  it('renders loading indicator when isLoading', () => {
    usePendingMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });
    setup();
    expect(screen.getByText(/Loading\.\.\./i)).toBeInTheDocument();
  });
});

describe('GovernanceInbox — Approve dialog', () => {
  it('clicking Approve opens the dialog', () => {
    setup();
    const approveBtn = screen.getByRole('button', { name: /Approve/i });
    fireEvent.click(approveBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('the approve dialog shows the four-eyes note', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Approve/i }));
    // admin.governance.fourEyesNote = "A different operator must approve this action (four-eyes rule)."
    expect(screen.getByText(/four-eyes rule/i)).toBeInTheDocument();
  });

  it('entering a code and confirming calls approveAction with { id, codigo }', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Approve/i }));
    const input = screen.getByRole('textbox', { name: /Authenticator code/i });
    fireEvent.change(input, { target: { value: '123456' } });
    // There are two Approve buttons now (row + dialog) — find the one inside the dialog
    const allApproveBtns = screen.getAllByRole('button', { name: /Approve/i });
    // The dialog confirm button is last in DOM order
    fireEvent.click(allApproveBtns[allApproveBtns.length - 1]);
    await waitFor(() => expect(mutateApprove).toHaveBeenCalled());
    expect(mutateApprove).toHaveBeenCalledWith(
      { id: 'action-1', codigo: '123456' },
      expect.anything(),
    );
  });

  it('the approve dialog confirm button is disabled while isPending', () => {
    useApproveActionMock.mockReturnValue(
      makeMutationMock(mutateApprove, { isPending: true }),
    );
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Approve/i }));
    const allApproveBtns = screen.getAllByRole('button', { name: /Approve/i });
    // dialog confirm button should be disabled (loading)
    expect(allApproveBtns[allApproveBtns.length - 1]).toBeDisabled();
  });
});

describe('GovernanceInbox — Reject dialog', () => {
  it('clicking Reject opens the dialog', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Reject/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('confirming reject calls rejectAction with { id, reason }', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Reject/i }));
    const reasonInput = screen.getByRole('textbox', { name: /Rejection reason/i });
    fireEvent.change(reasonInput, { target: { value: 'Suspicious activity' } });
    const allRejectBtns = screen.getAllByRole('button', { name: /Reject/i });
    fireEvent.click(allRejectBtns[allRejectBtns.length - 1]);
    await waitFor(() => expect(mutateReject).toHaveBeenCalled());
    expect(mutateReject).toHaveBeenCalledWith(
      { id: 'action-1', reason: 'Suspicious activity' },
      expect.anything(),
    );
  });

  it('confirming reject with no reason sends empty string as reason', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Reject/i }));
    const allRejectBtns = screen.getAllByRole('button', { name: /Reject/i });
    fireEvent.click(allRejectBtns[allRejectBtns.length - 1]);
    await waitFor(() => expect(mutateReject).toHaveBeenCalled());
    expect(mutateReject).toHaveBeenCalledWith(
      { id: 'action-1', reason: '' },
      expect.anything(),
    );
  });
});

describe('GovernanceInbox — error display', () => {
  it('renders tError message when approveAction has a 4xx error', () => {
    useApproveActionMock.mockReturnValue(
      makeMutationMock(mutateApprove, {
        isError: true,
        error: { code: 'UNAUTHORIZED', requestId: 'rid-totp-1' },
      }),
    );
    setup();
    // Open the approve dialog so the error is visible
    fireEvent.click(screen.getByRole('button', { name: /Approve/i }));
    // UNAUTHORIZED = "Authentication failed. Please check your credentials and try again."
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
