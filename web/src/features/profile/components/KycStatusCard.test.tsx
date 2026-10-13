// web/src/features/profile/components/KycStatusCard.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';

// ── Hoisted mock fns ──────────────────────────────────────────────────────────
const requestKycMutate = vi.fn();
const useKycStatusMock = vi.fn();
const useRequestKycMock = vi.fn();

vi.mock('../queries', () => ({
  useKycStatus: () => useKycStatusMock(),
  useRequestKyc: () => useRequestKycMock(),
}));

import { KycStatusCard } from './KycStatusCard';

// ── Helpers ───────────────────────────────────────────────────────────────────
function setup() {
  return render(
    <LocaleProvider>
      <KycStatusCard />
    </LocaleProvider>,
  );
}

function idleRequestKyc() {
  return {
    mutate: requestKycMutate,
    isPending: false,
    isError: false,
    error: null,
    isSuccess: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requestKycMutate.mockReset();

  // Default: unverified, none level, idle mutation
  useKycStatusMock.mockReturnValue({
    data: { kycVerified: false, kycLevel: 'none' },
    isLoading: false,
    isError: false,
  });
  useRequestKycMock.mockReturnValue(idleRequestKyc());
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('KycStatusCard', () => {
  // ── (1) Verified: shows verified indicator + level; NO CTA ────────────────
  it('shows the verified indicator and level when kycVerified is true, and NO CTA button', () => {
    useKycStatusMock.mockReturnValue({
      data: { kycVerified: true, kycLevel: 'full' },
      isLoading: false,
      isError: false,
    });
    setup();

    // Must show "Verified" text
    expect(screen.getByText(/^verified$|^verificado$/i)).toBeInTheDocument();

    // Must show the level label
    expect(screen.getByText(/verification level|nivel de verificación/i)).toBeInTheDocument();

    // No CTA button
    expect(screen.queryByRole('button', { name: /start verification|iniciar verificación/i })).toBeNull();
  });

  it('shows verified indicator and level for kycLevel "basic"', () => {
    useKycStatusMock.mockReturnValue({
      data: { kycVerified: true, kycLevel: 'basic' },
      isLoading: false,
      isError: false,
    });
    setup();
    expect(screen.getByText(/^verified$|^verificado$/i)).toBeInTheDocument();
    expect(screen.getByText(/verification level|nivel de verificación/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start verification|iniciar verificación/i })).toBeNull();
  });

  // ── (2) Unverified: renders CTA + external-provider note; click calls mutate ──
  it('shows CTA and external-provider note when kycVerified is false', () => {
    setup();

    expect(screen.getByRole('button', { name: /start verification|iniciar verificación/i })).toBeInTheDocument();
    // External provider note
    expect(
      screen.getByText(/external|proveedor|identity verification|verificación de identidad/i),
    ).toBeInTheDocument();
  });

  it('shows unverified status text when kycVerified is false', () => {
    setup();
    expect(screen.getByText(/not verified|sin verificar/i)).toBeInTheDocument();
  });

  it('clicking the CTA calls useRequestKyc().mutate() with no arguments', async () => {
    setup();

    const ctaBtn = screen.getByRole('button', { name: /start verification|iniciar verificación/i });
    fireEvent.click(ctaBtn);

    await waitFor(() => expect(requestKycMutate).toHaveBeenCalledTimes(1));
    // Must be called with NO arguments (void)
    expect(requestKycMutate).toHaveBeenCalledWith();
  });

  // ── (3) After request success: submitted/pending state renders ────────────
  it('shows submitted/pending note on isSuccess', () => {
    useRequestKycMock.mockReturnValue({
      ...idleRequestKyc(),
      isSuccess: true,
    });
    setup();

    // Submitted note must appear
    expect(
      screen.getByText(/submitted|under review|revisión|enviados/i),
    ).toBeInTheDocument();
  });

  it('hides the CTA after isSuccess', () => {
    useRequestKycMock.mockReturnValue({
      ...idleRequestKyc(),
      isSuccess: true,
    });
    setup();

    expect(screen.queryByRole('button', { name: /start verification|iniciar verificación/i })).toBeNull();
  });

  // ── (4) Loading state ─────────────────────────────────────────────────────
  it('shows a loading indicator while useKycStatus isLoading', () => {
    useKycStatusMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    setup();

    // Loading text
    expect(screen.getByText(/loading|cargando/i)).toBeInTheDocument();
  });

  // ── (5) Error state (query error) ────────────────────────────────────────
  it('shows an error message when useKycStatus isError', () => {
    useKycStatusMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });
    setup();

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  // ── (6) Mutation error: renders via tError ────────────────────────────────
  it('shows a translated mutation error via tError on isError', () => {
    useRequestKycMock.mockReturnValue({
      ...idleRequestKyc(),
      isError: true,
      error: { code: 'INTERNAL_ERROR', requestId: 'rid-55' },
    });
    setup();

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).not.toBe('');
  });

  // ── (7) Button disabled while isPending ──────────────────────────────────
  it('disables the CTA button while isPending', () => {
    useRequestKycMock.mockReturnValue({
      ...idleRequestKyc(),
      isPending: true,
    });
    setup();

    const ctaBtn = screen.getByRole('button', { name: /start verification|iniciar verificación/i });
    expect(ctaBtn).toBeDisabled();
  });
});
