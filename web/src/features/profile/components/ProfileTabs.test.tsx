// web/src/features/profile/components/ProfileTabs.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';

// ── Stub child components ─────────────────────────────────────────────────────
vi.mock('./ProfileForm', () => ({ ProfileForm: () => <div>stub-ProfileForm</div> }));
vi.mock('./ChangePasswordForm', () => ({ ChangePasswordForm: () => <div>stub-ChangePasswordForm</div> }));
vi.mock('./EmailChangeForm', () => ({ EmailChangeForm: () => <div>stub-EmailChangeForm</div> }));
vi.mock('./TwoFactorSettings', () => ({ TwoFactorSettings: () => <div>stub-TwoFactorSettings</div> }));
vi.mock('./NotificationsView', () => ({ NotificationsView: () => <div>stub-NotificationsView</div> }));
vi.mock('./KycStatusCard', () => ({ KycStatusCard: () => <div>stub-KycStatusCard</div> }));

import { ProfilePage } from './ProfileTabs';

function setup() {
  return render(
    <LocaleProvider>
      <ProfilePage />
    </LocaleProvider>,
  );
}

describe('ProfilePage (ProfileTabs)', () => {
  // ── (1) All 4 tabs render ──────────────────────────────────────────────────
  it('renders 4 tabs with correct labels', () => {
    setup();
    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);

    // Labels (en catalog: Account, Security, Notifications, Verification)
    expect(screen.getByRole('tab', { name: /account|cuenta/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /security|seguridad/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /notifications|notificaciones/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /verification|verificación/i })).toBeInTheDocument();
  });

  // ── (2) Account tab is active by default ─────────────────────────────────
  it('shows the account panel by default (aria-selected=true on account tab)', () => {
    setup();
    const accountTab = screen.getByRole('tab', { name: /account|cuenta/i });
    expect(accountTab).toHaveAttribute('aria-selected', 'true');

    // Stub is visible
    expect(screen.getByText('stub-ProfileForm')).toBeInTheDocument();
  });

  // ── (3) Clicking security tab switches panel ──────────────────────────────
  it('clicking Security tab shows security panel (all 3 forms) and deselects Account', () => {
    setup();
    const securityTab = screen.getByRole('tab', { name: /security|seguridad/i });
    fireEvent.click(securityTab);

    expect(securityTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /account|cuenta/i })).toHaveAttribute('aria-selected', 'false');

    expect(screen.getByText('stub-ChangePasswordForm')).toBeInTheDocument();
    expect(screen.getByText('stub-EmailChangeForm')).toBeInTheDocument();
    expect(screen.getByText('stub-TwoFactorSettings')).toBeInTheDocument();

    // Account panel hidden
    expect(screen.queryByText('stub-ProfileForm')).toBeNull();
  });

  // ── (4) Clicking notifications tab ───────────────────────────────────────
  it('clicking Notifications tab shows NotificationsView', () => {
    setup();
    fireEvent.click(screen.getByRole('tab', { name: /notifications|notificaciones/i }));

    expect(screen.getByText('stub-NotificationsView')).toBeInTheDocument();
    expect(screen.queryByText('stub-ProfileForm')).toBeNull();
  });

  // ── (5) Clicking KYC tab ──────────────────────────────────────────────────
  it('clicking KYC tab shows KycStatusCard', () => {
    setup();
    fireEvent.click(screen.getByRole('tab', { name: /verification|verificación/i }));

    expect(screen.getByText('stub-KycStatusCard')).toBeInTheDocument();
    expect(screen.queryByText('stub-ProfileForm')).toBeNull();
  });

  // ── (6) Non-active tabs are aria-selected=false ───────────────────────────
  it('non-active tabs have aria-selected=false', () => {
    setup();
    expect(screen.getByRole('tab', { name: /security|seguridad/i })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: /notifications|notificaciones/i })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: /verification|verificación/i })).toHaveAttribute('aria-selected', 'false');
  });
});
