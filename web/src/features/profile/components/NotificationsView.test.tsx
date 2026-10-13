// web/src/features/profile/components/NotificationsView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';

// ── Hoisted mock fns ───────────────────────────────────────────────────────────
const markAllReadMutate = vi.fn();
const markReadMutate = vi.fn();
const markUnreadMutate = vi.fn();
const deleteReadMutate = vi.fn();

const useNotificationsMock = vi.fn();
const useUnreadCountMock = vi.fn();
const useMarkAllReadMock = vi.fn();
const useMarkReadMock = vi.fn();
const useMarkUnreadMock = vi.fn();
const useDeleteReadMock = vi.fn();

vi.mock('../queries', () => ({
  useNotifications: () => useNotificationsMock(),
  useUnreadCount: () => useUnreadCountMock(),
  useMarkAllRead: () => useMarkAllReadMock(),
  useMarkRead: () => useMarkReadMock(),
  useMarkUnread: () => useMarkUnreadMock(),
  useDeleteRead: () => useDeleteReadMock(),
}));

import { NotificationsView } from './NotificationsView';

// ── Fixtures ───────────────────────────────────────────────────────────────────
const READ_NOTIFICATION = {
  id: 'n1',
  type: 'security' as const,
  title: 'Password changed',
  message: 'Your password was changed.',
  read: true,
  important: false,
  created_at: '2026-01-15T10:00:00Z',
};

const UNREAD_NOTIFICATION = {
  id: 'n2',
  type: 'transaction' as const,
  title: 'Deposit received',
  message: '0.01 BTC deposited.',
  read: false,
  important: true,
  created_at: '2026-01-16T12:00:00Z',
};

function idleMutation(mutateFn: ReturnType<typeof vi.fn>) {
  return { mutate: mutateFn, isPending: false };
}

function setup() {
  return render(
    <LocaleProvider>
      <NotificationsView />
    </LocaleProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  markAllReadMutate.mockReset();
  markReadMutate.mockReset();
  markUnreadMutate.mockReset();
  deleteReadMutate.mockReset();

  // Happy-path defaults
  useNotificationsMock.mockReturnValue({
    data: { notificaciones: [READ_NOTIFICATION, UNREAD_NOTIFICATION] },
    isLoading: false,
    isError: false,
  });
  useUnreadCountMock.mockReturnValue({ data: { count: 1 } });
  useMarkAllReadMock.mockReturnValue(idleMutation(markAllReadMutate));
  useMarkReadMock.mockReturnValue(idleMutation(markReadMutate));
  useMarkUnreadMock.mockReturnValue(idleMutation(markUnreadMutate));
  useDeleteReadMock.mockReturnValue(idleMutation(deleteReadMutate));
});

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('NotificationsView', () => {
  // (1) Renders a read and an unread item with their title and type label
  it('renders read notification title and type label', () => {
    setup();
    expect(screen.getByText('Password changed')).toBeInTheDocument();
    // type label for 'security'
    expect(screen.getByText(/security/i)).toBeInTheDocument();
  });

  it('renders unread notification title and type label', () => {
    setup();
    expect(screen.getByText('Deposit received')).toBeInTheDocument();
    // type label for 'transaction'
    expect(screen.getByText(/transaction/i)).toBeInTheDocument();
  });

  // (2) Unread item has an unread highlight CSS class
  it('applies unread highlight class to unread notification', () => {
    setup();
    // The unread item should carry a data attribute or class we can detect
    const unreadItem = screen.getByTestId('notification-n2');
    expect(unreadItem.className).toMatch(/unread/i);
  });

  it('does NOT apply unread highlight class to read notification', () => {
    setup();
    const readItem = screen.getByTestId('notification-n1');
    expect(readItem.className).not.toMatch(/unread/i);
  });

  // (3) Unread badge renders count
  it('shows unread count badge from useUnreadCount', () => {
    setup();
    expect(screen.getByText(/1 unread|1 sin leer/i)).toBeInTheDocument();
  });

  it('handles bare number unreadCount shape', () => {
    useUnreadCountMock.mockReturnValue({ data: 3 });
    setup();
    expect(screen.getByText(/3 unread|3 sin leer/i)).toBeInTheDocument();
  });

  // (4) "Mark all read" button calls mutation
  it('clicking "mark all read" calls useMarkAllRead().mutate()', async () => {
    setup();
    const btn = screen.getByRole('button', { name: /mark all as read|marcar todo como leído/i });
    fireEvent.click(btn);
    await waitFor(() => expect(markAllReadMutate).toHaveBeenCalledTimes(1));
  });

  // (5) Per-item mark-read on unread item
  it('clicking "mark as read" on an unread item calls useMarkRead().mutate(id)', async () => {
    setup();
    // Find the mark-read button next to UNREAD_NOTIFICATION (n2)
    const unreadItem = screen.getByTestId('notification-n2');
    const markReadBtn = unreadItem.querySelector('button[data-action="mark-read"]') ??
      screen.getAllByRole('button', { name: /mark as read|marcar como leída/i })[0];
    fireEvent.click(markReadBtn!);
    await waitFor(() => expect(markReadMutate).toHaveBeenCalledWith('n2'));
  });

  // (6) Per-item mark-unread on read item
  it('clicking "mark as unread" on a read item calls useMarkUnread().mutate(id)', async () => {
    setup();
    const readItem = screen.getByTestId('notification-n1');
    const markUnreadBtn = readItem.querySelector('button[data-action="mark-unread"]') ??
      screen.getAllByRole('button', { name: /mark as unread|marcar como no leída/i })[0];
    fireEvent.click(markUnreadBtn!);
    await waitFor(() => expect(markUnreadMutate).toHaveBeenCalledWith('n1'));
  });

  // (7) "Delete read" button calls mutation
  it('clicking "delete read" calls useDeleteRead().mutate()', async () => {
    setup();
    const btn = screen.getByRole('button', { name: /delete read|eliminar leídas/i });
    fireEvent.click(btn);
    await waitFor(() => expect(deleteReadMutate).toHaveBeenCalledTimes(1));
  });

  // (8) Buttons are disabled while pending
  it('disables "mark all read" while isPending', () => {
    useMarkAllReadMock.mockReturnValue({ mutate: markAllReadMutate, isPending: true });
    setup();
    expect(
      screen.getByRole('button', { name: /mark all as read|marcar todo como leído/i }),
    ).toBeDisabled();
  });

  it('disables per-item "mark as read" button while markRead isPending', () => {
    useMarkReadMock.mockReturnValue({ mutate: markReadMutate, isPending: true });
    setup();
    const unreadItem = screen.getByTestId('notification-n2');
    const btn = unreadItem.querySelector('button') as HTMLButtonElement;
    expect(btn).toBeDisabled();
  });

  // (9) Loading state
  it('shows loading state', () => {
    useNotificationsMock.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    setup();
    expect(screen.getByText(/loading|cargando/i)).toBeInTheDocument();
  });

  // (10) Empty state
  it('shows empty state when no notifications', () => {
    useNotificationsMock.mockReturnValue({
      data: { notificaciones: [] },
      isLoading: false,
      isError: false,
    });
    setup();
    expect(
      screen.getByText(/you have no notifications|no tenés notificaciones/i),
    ).toBeInTheDocument();
  });

  // (11) Error state
  it('shows error state on isError', () => {
    useNotificationsMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    setup();
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toMatch(/notifications|notificaciones/i);
  });
});
