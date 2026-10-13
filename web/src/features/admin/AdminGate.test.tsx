import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

const useCurrentUserMock = vi.fn();

vi.mock('@/features/auth/queries', () => ({
  useCurrentUser: () => useCurrentUserMock(),
}));

import { AdminGate } from './AdminGate';

beforeEach(() => {
  replaceMock.mockReset();
  useCurrentUserMock.mockReset();
});

describe('AdminGate', () => {
  it('renders children when user has admin role', async () => {
    useCurrentUserMock.mockReturnValue({ data: { role: 'admin' }, isLoading: false });
    render(<AdminGate><span>admin-content</span></AdminGate>);
    expect(screen.getByText('admin-content')).toBeTruthy();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('redirects to /dashboard and renders nothing when user is not admin', async () => {
    useCurrentUserMock.mockReturnValue({ data: { role: 'normal' }, isLoading: false });
    render(<AdminGate><span>admin-content</span></AdminGate>);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/dashboard'));
    expect(screen.queryByText('admin-content')).toBeNull();
  });

  it('renders nothing while loading', () => {
    useCurrentUserMock.mockReturnValue({ data: undefined, isLoading: true });
    render(<AdminGate><span>admin-content</span></AdminGate>);
    expect(screen.queryByText('admin-content')).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
