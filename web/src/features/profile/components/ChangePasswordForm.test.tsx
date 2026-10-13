// web/src/features/profile/components/ChangePasswordForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';
import { ApiError } from '@/shared/api';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const mutate = vi.fn();
const useChangePasswordMock = vi.fn();

vi.mock('../queries', () => ({
  useChangePassword: () => useChangePasswordMock(),
}));

import { ChangePasswordForm } from './ChangePasswordForm';

// ── Helpers ───────────────────────────────────────────────────────────────────
function setup() {
  return render(
    <LocaleProvider>
      <ChangePasswordForm />
    </LocaleProvider>,
  );
}

function getFields() {
  const current = screen.getByLabelText(/current password|contraseña actual/i) as HTMLInputElement;
  const newPw = screen.getByLabelText(/^new password|^nueva contraseña/i) as HTMLInputElement;
  const confirm = screen.getByLabelText(/confirm new password|confirmá la nueva contraseña/i) as HTMLInputElement;
  return { current, newPw, confirm };
}

function getSubmitButton() {
  return screen.getByRole('button', { name: /update password|actualizar contraseña/i });
}

// Default: idle mutation
beforeEach(() => {
  vi.clearAllMocks();
  mutate.mockReset();
  useChangePasswordMock.mockReturnValue({
    mutate,
    isPending: false,
    isError: false,
    error: null,
    isSuccess: false,
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('ChangePasswordForm', () => {
  // ── (1) All fields empty → submit disabled ────────────────────────────────
  it('disables submit when all fields are empty', () => {
    setup();
    expect(getSubmitButton()).toBeDisabled();
  });

  // ── (2) Mismatch: newPassword !== confirmNewPassword ─────────────────────
  it('disables submit and shows mismatch advisory when passwords do not match', () => {
    setup();
    const { current, newPw, confirm } = getFields();

    fireEvent.change(current, { target: { value: 'OldPass1' } });
    fireEvent.change(newPw, { target: { value: 'NewPass1' } });
    fireEvent.change(confirm, { target: { value: 'Different1' } });

    expect(getSubmitButton()).toBeDisabled();
    expect(screen.getByText(/do not match|no coinciden/i)).toBeInTheDocument();
  });

  // ── (3) Too short: newPassword < 8 chars ─────────────────────────────────
  it('disables submit and shows weak-password advisory when new password is too short', () => {
    setup();
    const { current, newPw, confirm } = getFields();

    fireEvent.change(current, { target: { value: 'OldPass1' } });
    fireEvent.change(newPw, { target: { value: 'abc' } });
    fireEvent.change(confirm, { target: { value: 'abc' } });

    expect(getSubmitButton()).toBeDisabled();
    expect(screen.getByText(/too weak|muy débil/i)).toBeInTheDocument();
  });

  // ── (4) Same as current → disables submit ────────────────────────────────
  it('disables submit when new password is the same as current password', () => {
    setup();
    const { current, newPw, confirm } = getFields();

    fireEvent.change(current, { target: { value: 'SamePass1' } });
    fireEvent.change(newPw, { target: { value: 'SamePass1' } });
    fireEvent.change(confirm, { target: { value: 'SamePass1' } });

    expect(getSubmitButton()).toBeDisabled();
  });

  // ── (5) Valid submit: sends ONLY { currentPassword, newPassword } ─────────
  it('calls mutate with { currentPassword, newPassword } only — no confirmNewPassword on the wire', async () => {
    setup();
    const { current, newPw, confirm } = getFields();

    fireEvent.change(current, { target: { value: 'OldPass1' } });
    fireEvent.change(newPw, { target: { value: 'NewPass1!' } });
    fireEvent.change(confirm, { target: { value: 'NewPass1!' } });

    expect(getSubmitButton()).not.toBeDisabled();
    fireEvent.click(getSubmitButton());

    await waitFor(() => expect(mutate).toHaveBeenCalled());

    const payload = mutate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toEqual({ currentPassword: 'OldPass1', newPassword: 'NewPass1!' });
    // Security: confirm field must NOT be on the wire
    expect(payload).not.toHaveProperty('confirmNewPassword');
    expect(payload).not.toHaveProperty('confirm');
  });

  // ── (6) Pending state disables submit ────────────────────────────────────
  it('disables submit and shows loading while isPending', () => {
    useChangePasswordMock.mockReturnValue({
      mutate,
      isPending: true,
      isError: false,
      error: null,
      isSuccess: false,
    });
    setup();
    // Even if fields would otherwise pass validation, button is disabled
    const { current, newPw, confirm } = getFields();
    fireEvent.change(current, { target: { value: 'OldPass1' } });
    fireEvent.change(newPw, { target: { value: 'NewPass1!' } });
    fireEvent.change(confirm, { target: { value: 'NewPass1!' } });

    expect(getSubmitButton()).toBeDisabled();
  });

  // ── (7) Success: fields cleared + success message ────────────────────────
  it('shows success message on isSuccess', () => {
    useChangePasswordMock.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      isSuccess: true,
    });
    setup();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/updated successfully|actualizada correctamente/i)).toBeInTheDocument();
  });

  // ── (8) Error: rendered via tError ───────────────────────────────────────
  it('shows a translated error on isError', () => {
    useChangePasswordMock.mockReturnValue({
      mutate,
      isPending: false,
      isError: true,
      error: { code: 'INVALID_CREDENTIALS', requestId: 'rid-42' },
      isSuccess: false,
    });
    setup();
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    // INVALID_CREDENTIALS → "Invalid email or password."
    expect(alert.textContent).toMatch(/invalid email or password|email o contraseña inválidos/i);
  });

  // ── (9) All inputs are type="password" ───────────────────────────────────
  it('renders all three fields as type="password"', () => {
    setup();
    const { current, newPw, confirm } = getFields();
    expect(current.type).toBe('password');
    expect(newPw.type).toBe('password');
    expect(confirm.type).toBe('password');
  });
});
