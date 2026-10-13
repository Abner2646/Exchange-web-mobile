// web/src/features/admin/components/UsersAdmin.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';
import { UsersAdmin } from './UsersAdmin';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const mutateStatus = vi.fn();
const mutateKyc = vi.fn();
const mutateDailyLimit = vi.fn();
const mutateReputation = vi.fn();
const mutateRole = vi.fn();
const mutateDelete = vi.fn();

const useUsersMock = vi.fn();
const useUpdateUserStatusMock = vi.fn();
const useUpdateUserKycMock = vi.fn();
const useUpdateUserDailyLimitMock = vi.fn();
const useUpdateUserReputationMock = vi.fn();
const useUpdateUserRoleMock = vi.fn();
const useDeleteUserMock = vi.fn();
const useUserStatsMock = vi.fn();
const useCurrentUserMock = vi.fn();

vi.mock('../queries', () => ({
  useUsers: () => useUsersMock(),
  useUpdateUserStatus: () => useUpdateUserStatusMock(),
  useUpdateUserKyc: () => useUpdateUserKycMock(),
  useUpdateUserDailyLimit: () => useUpdateUserDailyLimitMock(),
  useUpdateUserReputation: () => useUpdateUserReputationMock(),
  useUpdateUserRole: () => useUpdateUserRoleMock(),
  useDeleteUser: () => useDeleteUserMock(),
  useUserStats: () => useUserStatsMock(),
}));

vi.mock('@/features/auth/queries', () => ({
  useCurrentUser: () => useCurrentUserMock(),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────
const MOCK_USERS = [
  {
    id: 'u1',
    username: 'alice',
    email: 'alice@example.com',
    role: 'user',
    active: true,
    kycVerified: false,
  },
  {
    id: 'u2',
    username: 'bob',
    email: 'bob@example.com',
    role: 'admin',
    active: false,
    kycVerified: true,
  },
];

const MOCK_STATS = { totalUsers: 2, activeUsers: 1 };

function makeMutationMock(mutateFn: ReturnType<typeof vi.fn>, options?: { isPending?: boolean; isError?: boolean; error?: unknown }) {
  return {
    mutate: mutateFn,
    isPending: options?.isPending ?? false,
    isError: options?.isError ?? false,
    error: options?.error ?? null,
  };
}

function defaultSetup() {
  useUsersMock.mockReturnValue({ data: MOCK_USERS, isLoading: false });
  useUpdateUserStatusMock.mockReturnValue(makeMutationMock(mutateStatus));
  useUpdateUserKycMock.mockReturnValue(makeMutationMock(mutateKyc));
  useUpdateUserDailyLimitMock.mockReturnValue(makeMutationMock(mutateDailyLimit));
  useUpdateUserReputationMock.mockReturnValue(makeMutationMock(mutateReputation));
  useUpdateUserRoleMock.mockReturnValue(makeMutationMock(mutateRole));
  useDeleteUserMock.mockReturnValue(makeMutationMock(mutateDelete));
  useUserStatsMock.mockReturnValue({ data: MOCK_STATS });
}

beforeEach(() => {
  vi.clearAllMocks();
  defaultSetup();
});

function setup() {
  return render(
    <LocaleProvider>
      <UsersAdmin />
    </LocaleProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UsersAdmin — super-admin current user', () => {
  beforeEach(() => {
    useCurrentUserMock.mockReturnValue({ data: { id: 'admin1', role: 'super_admin' } });
  });

  it('renders the user list with username and email', () => {
    setup();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });

  it('renders role-change controls for super-admin', () => {
    setup();
    // Should find at least one "Change role" label (one per user)
    const roleBtns = screen.getAllByRole('button', { name: /Change role|Cambiar rol/i });
    expect(roleBtns.length).toBeGreaterThan(0);
  });

  it('renders delete controls for super-admin', () => {
    setup();
    const delBtns = screen.getAllByRole('button', { name: /Delete user|Eliminar usuario/i });
    expect(delBtns.length).toBeGreaterThan(0);
  });

  it('clicking delete opens the confirm Dialog', () => {
    setup();
    const delBtns = screen.getAllByRole('button', { name: /Delete user|Eliminar usuario/i });
    fireEvent.click(delBtns[0]);
    // Dialog should now be open — look for dialog role or confirm button
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('confirming delete calls deleteUser with the user id', async () => {
    setup();
    const delBtns = screen.getAllByRole('button', { name: /Delete user|Eliminar usuario/i });
    fireEvent.click(delBtns[0]);
    // Find the confirm button inside the dialog
    const confirmBtn = screen.getByRole('button', { name: /Confirm|Confirmar/i });
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(mutateDelete).toHaveBeenCalled());
    // The mutate call includes onSuccess/onError callbacks; verify the id arg
    expect(mutateDelete).toHaveBeenCalledWith(
      { id: MOCK_USERS[0].id },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('renders stats panel', () => {
    setup();
    expect(screen.getByText(/User statistics|Estadísticas de usuarios/i)).toBeInTheDocument();
  });
});

describe('UsersAdmin — plain-admin current user', () => {
  beforeEach(() => {
    useCurrentUserMock.mockReturnValue({ data: { id: 'admin2', role: 'admin' } });
  });

  it('does NOT render role-change controls', () => {
    setup();
    expect(screen.queryByRole('button', { name: /Change role|Cambiar rol/i })).toBeNull();
  });

  it('does NOT render delete controls', () => {
    setup();
    expect(screen.queryByRole('button', { name: /Delete user|Eliminar usuario/i })).toBeNull();
  });

  it('still renders the user list', () => {
    setup();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
  });
});

describe('UsersAdmin — status toggle', () => {
  beforeEach(() => {
    useCurrentUserMock.mockReturnValue({ data: { id: 'admin1', role: 'super_admin' } });
  });

  it('toggling active status calls useUpdateUserStatus.mutate with correct args', async () => {
    setup();
    // Find the toggle for the first user (alice, active: true — toggling to false)
    const toggleBtns = screen.getAllByRole('button', { name: /Toggle active|Cambiar estado/i });
    fireEvent.click(toggleBtns[0]);
    await waitFor(() => expect(mutateStatus).toHaveBeenCalled());
    expect(mutateStatus).toHaveBeenCalledWith({
      id: MOCK_USERS[0].id,
      body: { active: !MOCK_USERS[0].active },
    });
  });
});

describe('UsersAdmin — error display', () => {
  beforeEach(() => {
    useCurrentUserMock.mockReturnValue({ data: { id: 'admin1', role: 'super_admin' } });
  });

  it('renders an error alert when a mutation has an error', () => {
    useUpdateUserStatusMock.mockReturnValue(
      makeMutationMock(mutateStatus, {
        isError: true,
        error: { code: 'INTERNAL_ERROR', requestId: 'rid-1' },
      }),
    );
    setup();
    // Both rows will show an alert since the mock is shared — at least one must be present
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
  });
});
