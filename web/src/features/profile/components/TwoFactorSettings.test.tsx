// web/src/features/profile/components/TwoFactorSettings.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';

// ── Hoisted mock fns ──────────────────────────────────────────────────────────
const toggle2FAMutate = vi.fn();
const totpSetupMutate = vi.fn();
const totpEnableMutate = vi.fn();
const totpDisableMutate = vi.fn();

const useCurrentUserMock = vi.fn();
const useToggle2FAMock = vi.fn();
const useTotpSetupMock = vi.fn();
const useTotpEnableMock = vi.fn();
const useTotpDisableMock = vi.fn();

vi.mock('@/features/auth/queries', () => ({
  useCurrentUser: () => useCurrentUserMock(),
}));

vi.mock('../queries', () => ({
  useToggle2FA: () => useToggle2FAMock(),
  useTotpSetup: () => useTotpSetupMock(),
  useTotpEnable: () => useTotpEnableMock(),
  useTotpDisable: () => useTotpDisableMock(),
}));

import { TwoFactorSettings } from './TwoFactorSettings';

// ── Helpers ───────────────────────────────────────────────────────────────────
function setup() {
  return render(
    <LocaleProvider>
      <TwoFactorSettings />
    </LocaleProvider>,
  );
}

// Default user: email-2FA disabled, TOTP not enrolled
const BASE_USER = {
  id: 'u1',
  username: 'alice',
  email: 'alice@example.com',
  active: true,
  role: 'user',
  emailVerified: true,
  twoFactorEnabled: false,
  totpEnabled: false,
  kycVerified: false,
  kycLevel: 'none' as const,
};

// Default idle mutation state
function idleMutation(mutateFn: ReturnType<typeof vi.fn>) {
  return {
    mutate: mutateFn,
    isPending: false,
    isError: false,
    error: null,
    isSuccess: false,
    data: undefined,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  toggle2FAMutate.mockReset();
  totpSetupMutate.mockReset();
  totpEnableMutate.mockReset();
  totpDisableMutate.mockReset();

  useCurrentUserMock.mockReturnValue({ data: BASE_USER });
  useToggle2FAMock.mockReturnValue(idleMutation(toggle2FAMutate));
  useTotpSetupMock.mockReturnValue(idleMutation(totpSetupMutate));
  useTotpEnableMock.mockReturnValue(idleMutation(totpEnableMutate));
  useTotpDisableMock.mockReturnValue(idleMutation(totpDisableMutate));
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('TwoFactorSettings', () => {
  // ── (1) Email 2FA toggle calls mutate with NO args ────────────────────────
  it('calls toggle2FA mutate with no args when toggle button is clicked', async () => {
    setup();

    const toggleBtn = screen.getByRole('button', {
      name: /enable email 2fa|habilitar 2fa por email/i,
    });
    fireEvent.click(toggleBtn);

    await waitFor(() => expect(toggle2FAMutate).toHaveBeenCalledTimes(1));
    // Security: must be called with NO arguments (void)
    expect(toggle2FAMutate).toHaveBeenCalledWith();
  });

  it('shows "Disabled" status when twoFactorEnabled is false', () => {
    setup();
    expect(screen.getByText(/disabled|deshabilitado/i)).toBeInTheDocument();
  });

  it('shows "Enabled" status when twoFactorEnabled is true', () => {
    useCurrentUserMock.mockReturnValue({ data: { ...BASE_USER, twoFactorEnabled: true } });
    setup();
    expect(screen.getByText(/^enabled$|^habilitado$/i)).toBeInTheDocument();
  });

  it('disables the email toggle button while isPending', () => {
    useToggle2FAMock.mockReturnValue({ ...idleMutation(toggle2FAMutate), isPending: true });
    setup();
    const btn = screen.getByRole('button', { name: /enable email 2fa|habilitar 2fa por email/i });
    expect(btn).toBeDisabled();
  });

  // ── (2) TOTP enroll flow: setup → QR/secret → enable sends { codigo } ─────
  it('shows Enroll button when totpEnabled is false', () => {
    setup();
    expect(
      screen.getByRole('button', { name: /set up authenticator app|configurar app autenticadora/i }),
    ).toBeInTheDocument();
  });

  it('clicking Enroll calls totpSetup mutate', async () => {
    setup();
    const enrollBtn = screen.getByRole('button', {
      name: /set up authenticator app|configurar app autenticadora/i,
    });
    fireEvent.click(enrollBtn);

    await waitFor(() => expect(totpSetupMutate).toHaveBeenCalledTimes(1));
  });

  it('renders QR image and secret after setup resolves', async () => {
    const setupSuccessData = {
      otpauthUri: 'otpauth://totp/test?secret=JBSWY3DPEHPK3PXP',
      secret: 'JBSWY3DPEHPK3PXP',
      qr: 'data:image/png;base64,ABC123',
    };

    // Simulate setup mutation with data (as if onSuccess fired and data is available)
    useTotpSetupMock.mockReturnValue({
      ...idleMutation(totpSetupMutate),
      isSuccess: true,
      data: setupSuccessData,
    });

    setup();

    // QR image must appear
    const qrImg = screen.getByRole('img');
    expect(qrImg).toBeInTheDocument();
    expect(qrImg).toHaveAttribute('src', 'data:image/png;base64,ABC123');

    // Secret must appear as text (shown once)
    expect(screen.getByText(/JBSWY3DPEHPK3PXP/)).toBeInTheDocument();
  });

  it('Enable button sends { codigo } to totpEnable.mutate', async () => {
    const setupSuccessData = {
      otpauthUri: 'otpauth://totp/test?secret=JBSWY3DPEHPK3PXP',
      secret: 'JBSWY3DPEHPK3PXP',
      qr: 'data:image/png;base64,ABC123',
    };

    useTotpSetupMock.mockReturnValue({
      ...idleMutation(totpSetupMutate),
      isSuccess: true,
      data: setupSuccessData,
    });

    setup();

    // Find the codigo input and fill it
    const codeInput = screen.getByLabelText(/authenticator code|código de la app autenticadora/i);
    fireEvent.change(codeInput, { target: { value: '123456' } });

    // Click Enable TOTP
    const enableBtn = screen.getByRole('button', { name: /enable totp|habilitar totp/i });
    fireEvent.click(enableBtn);

    await waitFor(() => expect(totpEnableMutate).toHaveBeenCalledTimes(1));
    // Security: first arg must be exactly { codigo } — no extra fields on the wire
    const [firstArg] = totpEnableMutate.mock.calls[0] as [unknown];
    expect(firstArg).toEqual({ codigo: '123456' });
  });

  it('clears the setup state (qr/secret) on enable success', async () => {
    const setupSuccessData = {
      otpauthUri: 'otpauth://totp/test?secret=JBSWY3DPEHPK3PXP',
      secret: 'JBSWY3DPEHPK3PXP',
      qr: 'data:image/png;base64,ABC123',
    };

    useTotpSetupMock.mockReturnValue({
      ...idleMutation(totpSetupMutate),
      isSuccess: true,
      data: setupSuccessData,
    });

    // Capture the onSuccess callback from the mutate call (2nd arg = options)
    totpEnableMutate.mockImplementation(
      (_payload: unknown, opts?: { onSuccess?: () => void }) => {
        // Simulate immediate async success
        opts?.onSuccess?.();
      },
    );

    const { queryByRole } = setup();

    const codeInput = screen.getByLabelText(/authenticator code|código de la app autenticadora/i);
    fireEvent.change(codeInput, { target: { value: '123456' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /enable totp|habilitar totp/i }));
    });

    // After enable success, QR image must be gone (enrollState cleared)
    await waitFor(() => expect(queryByRole('img')).toBeNull());
    // Secret text must be gone
    expect(screen.queryByText(/JBSWY3DPEHPK3PXP/)).toBeNull();
  });

  it('disables Enable TOTP button while totpEnable isPending', async () => {
    const setupSuccessData = {
      otpauthUri: 'otpauth://totp/test?secret=SECRET',
      secret: 'SECRET',
      qr: 'data:image/png;base64,ABC',
    };

    useTotpSetupMock.mockReturnValue({
      ...idleMutation(totpSetupMutate),
      isSuccess: true,
      data: setupSuccessData,
    });
    useTotpEnableMock.mockReturnValue({ ...idleMutation(totpEnableMutate), isPending: true });

    setup();
    const enableBtn = screen.getByRole('button', { name: /enable totp|habilitar totp/i });
    expect(enableBtn).toBeDisabled();
  });

  // ── (3) TOTP disable flow: Dialog + confirm sends { codigo } ─────────────
  it('shows Disable TOTP button when totpEnabled is true', () => {
    useCurrentUserMock.mockReturnValue({ data: { ...BASE_USER, totpEnabled: true } });
    setup();
    expect(
      screen.getByRole('button', { name: /disable totp|deshabilitar totp/i }),
    ).toBeInTheDocument();
  });

  it('clicking Disable opens the confirm Dialog', async () => {
    useCurrentUserMock.mockReturnValue({ data: { ...BASE_USER, totpEnabled: true } });
    setup();

    const disableBtn = screen.getByRole('button', { name: /disable totp|deshabilitar totp/i });
    fireEvent.click(disableBtn);

    // Dialog must be open — role="dialog"
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  });

  it('confirming disable sends { codigo } to totpDisable.mutate', async () => {
    useCurrentUserMock.mockReturnValue({ data: { ...BASE_USER, totpEnabled: true } });
    setup();

    // Open dialog by clicking the outer Disable TOTP button (danger variant)
    // There is only one button rendered before the dialog opens
    fireEvent.click(screen.getByRole('button', { name: /disable totp|deshabilitar totp/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    // Scope queries inside the dialog to avoid ambiguity with the outer button
    const dialogEl = screen.getByRole('dialog');
    const dialogScope = within(dialogEl);

    // Fill code input inside dialog
    const codeInput = dialogScope.getByLabelText(/authenticator code|código de la app autenticadora/i);
    fireEvent.change(codeInput, { target: { value: '654321' } });

    // Click the confirm button (Disable TOTP) inside the dialog
    const confirmBtn = dialogScope.getByRole('button', { name: /disable totp|deshabilitar totp/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(totpDisableMutate).toHaveBeenCalledTimes(1));
    // Security: first arg must be exactly { codigo } — no extra fields on the wire
    const [firstArg] = totpDisableMutate.mock.calls[0] as [unknown];
    expect(firstArg).toEqual({ codigo: '654321' });
  });

  it('disables the Disable TOTP button while totpDisable isPending', () => {
    useCurrentUserMock.mockReturnValue({ data: { ...BASE_USER, totpEnabled: true } });
    useTotpDisableMock.mockReturnValue({ ...idleMutation(totpDisableMutate), isPending: true });
    setup();
    expect(
      screen.getByRole('button', { name: /disable totp|deshabilitar totp/i }),
    ).toBeDisabled();
  });

  // ── (4) Error: bad-code error renders via tError ──────────────────────────
  it('renders a translated error on totpEnable failure (bad code → INVALID_TOTP_CODE)', () => {
    const setupSuccessData = {
      otpauthUri: 'otpauth://totp/test?secret=SECRET',
      secret: 'SECRET',
      qr: 'data:image/png;base64,ABC',
    };

    useTotpSetupMock.mockReturnValue({
      ...idleMutation(totpSetupMutate),
      isSuccess: true,
      data: setupSuccessData,
    });
    useTotpEnableMock.mockReturnValue({
      ...idleMutation(totpEnableMutate),
      isError: true,
      error: { code: 'INVALID_TOTP_CODE', requestId: 'rid-99' },
    });

    setup();

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    // tError with INVALID_TOTP_CODE should produce a non-empty message
    expect(alert.textContent).not.toBe('');
  });

  it('renders a translated error on toggle2FA failure', () => {
    useToggle2FAMock.mockReturnValue({
      ...idleMutation(toggle2FAMutate),
      isError: true,
      error: { code: 'INVALID_TOTP_CODE', requestId: 'rid-1' },
    });
    setup();
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).not.toBe('');
  });

  // ── (5) Null user → renders nothing (loading state) ──────────────────────
  it('renders nothing when user data is null (loading)', () => {
    useCurrentUserMock.mockReturnValue({ data: null });
    const { container } = setup();
    expect(container.firstChild).toBeNull();
  });
});
