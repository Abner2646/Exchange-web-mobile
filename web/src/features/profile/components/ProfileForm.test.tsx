// web/src/features/profile/components/ProfileForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';
import { ProfileForm } from './ProfileForm';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const mutate = vi.fn();
const useUpdateProfileMock = vi.fn();
const useCurrentUserMock = vi.fn();
const setLocaleMock = vi.fn();
const useLocaleMock = vi.fn();

vi.mock('../queries', () => ({
  useUpdateProfile: () => useUpdateProfileMock(),
}));

vi.mock('@/features/auth/queries', () => ({
  useCurrentUser: () => useCurrentUserMock(),
}));

vi.mock('@/shared/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/i18n')>();
  return {
    ...actual,
    useLocale: () => useLocaleMock(),
  };
});

// ── Test fixtures ─────────────────────────────────────────────────────────────
const MOCK_USER = {
  id: 'u1',
  username: 'alice123',
  email: 'alice@example.com',
  displayName: 'Alice',
  country: 'US',
  state: 'NY',
  locale: 'en',
  active: true,
  role: 'user',
  emailVerified: true,
  twoFactorEnabled: false,
  kycVerified: false,
  kycLevel: 'none' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mutate.mockReset();
  useUpdateProfileMock.mockReturnValue({
    mutate,
    isPending: false,
    isError: false,
    error: null,
    isSuccess: false,
  });
  useCurrentUserMock.mockReturnValue({ data: MOCK_USER });
  useLocaleMock.mockReturnValue({ locale: 'en', setLocale: setLocaleMock });
});

function setup() {
  return render(
    <LocaleProvider>
      <ProfileForm />
    </LocaleProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('ProfileForm', () => {
  it('pre-fills controlled fields from current user', () => {
    setup();
    expect((screen.getByLabelText(/Display name|Nombre visible/i) as HTMLInputElement).value).toBe('Alice');
    expect((screen.getByLabelText(/Country|País/i) as HTMLInputElement).value).toBe('US');
    expect((screen.getByLabelText(/State|Provincia/i) as HTMLInputElement).value).toBe('NY');
  });

  it('shows username as read-only / disabled', () => {
    setup();
    const usernameInput = screen.getByDisplayValue('alice123') as HTMLInputElement;
    expect(usernameInput.disabled || usernameInput.readOnly).toBe(true);
  });

  it('shows email as read-only / disabled', () => {
    setup();
    const emailInput = screen.getByDisplayValue('alice@example.com') as HTMLInputElement;
    expect(emailInput.disabled || emailInput.readOnly).toBe(true);
  });

  it('shows a note that username cannot be changed', () => {
    setup();
    expect(screen.getByText(/cannot be changed|no se puede cambiar/i)).toBeInTheDocument();
  });

  it('submits the 4 whitelisted fields on save', async () => {
    setup();
    fireEvent.change(screen.getByLabelText(/Display name|Nombre visible/i), {
      target: { value: 'Alice Smith' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save|Guardar/i }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    // First argument is the payload; second is the options object ({ onSuccess })
    expect(mutate.mock.calls[0][0]).toEqual({
      displayName: 'Alice Smith',
      country: 'US',
      state: 'NY',
      locale: 'en',
    });
  });

  it('does NOT include username or email in the submit payload', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Save|Guardar/i }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    // First argument is the payload (second is options)
    const payload = mutate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('username');
    expect(payload).not.toHaveProperty('email');
  });

  it('calls setLocale when the locale select changes and save succeeds', async () => {
    // Simulate mutate calling onSuccess immediately
    mutate.mockImplementation((_args: unknown, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });
    setup();

    const localeSelect = screen.getByLabelText(/Language|Idioma/i) as HTMLSelectElement;
    fireEvent.change(localeSelect, { target: { value: 'es' } });
    fireEvent.click(screen.getByRole('button', { name: /Save|Guardar/i }));

    await waitFor(() => expect(setLocaleMock).toHaveBeenCalledWith('es'));
  });

  it('does NOT call setLocale when locale is unchanged', async () => {
    mutate.mockImplementation((_args: unknown, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });
    setup();
    // locale stays 'en' (same as app locale from useLocaleMock)
    fireEvent.click(screen.getByRole('button', { name: /Save|Guardar/i }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(setLocaleMock).not.toHaveBeenCalled();
  });

  it('disables button while pending', () => {
    useUpdateProfileMock.mockReturnValue({
      mutate,
      isPending: true,
      isError: false,
      error: null,
      isSuccess: false,
    });
    setup();
    expect(screen.getByRole('button', { name: /Save|Guardar/i })).toBeDisabled();
  });

  it('shows success message on isSuccess', () => {
    useUpdateProfileMock.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      isSuccess: true,
    });
    setup();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows an error message on isError', () => {
    useUpdateProfileMock.mockReturnValue({
      mutate,
      isPending: false,
      isError: true,
      error: { code: 'INTERNAL_ERROR', requestId: 'rid-1' },
      isSuccess: false,
    });
    setup();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders nothing when user data is null (loading)', () => {
    useCurrentUserMock.mockReturnValue({ data: null });
    const { container } = setup();
    expect(container.querySelector('form')).toBeNull();
  });
});
