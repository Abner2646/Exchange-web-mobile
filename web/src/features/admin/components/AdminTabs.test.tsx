// web/src/features/admin/components/AdminTabs.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';

// ── Stub child components ─────────────────────────────────────────────────────
vi.mock('./GovernanceInbox', () => ({ GovernanceInbox: () => <div>stub-GovernanceInbox</div> }));
vi.mock('./OperatorReadinessCard', () => ({ OperatorReadinessCard: () => <div>stub-OperatorReadinessCard</div> }));
vi.mock('./UsersAdmin', () => ({ UsersAdmin: () => <div>stub-UsersAdmin</div> }));
vi.mock('./BusinessConfigEditor', () => ({ BusinessConfigEditor: () => <div>stub-BusinessConfigEditor</div> }));
vi.mock('./AmlOps', () => ({ AmlOps: () => <div>stub-AmlOps</div> }));
vi.mock('./AuditViewer', () => ({ AuditViewer: () => <div>stub-AuditViewer</div> }));

import { AdminPage } from './AdminTabs';

function setup() {
  return render(
    <LocaleProvider>
      <AdminPage />
    </LocaleProvider>,
  );
}

describe('AdminPage (AdminTabs)', () => {
  // ── (1) All 5 tabs render ─────────────────────────────────────────────────
  it('renders 5 tabs with correct labels', () => {
    setup();
    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(5);

    expect(screen.getByRole('tab', { name: /governance/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /users/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /config/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /aml/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /audit/i })).toBeInTheDocument();
  });

  // ── (2) Governance tab is active by default ───────────────────────────────
  it('shows the governance panel by default (aria-selected=true on governance tab)', () => {
    setup();
    const govTab = screen.getByRole('tab', { name: /governance/i });
    expect(govTab).toHaveAttribute('aria-selected', 'true');

    // Both governance stubs are visible
    expect(screen.getByText('stub-GovernanceInbox')).toBeInTheDocument();
    expect(screen.getByText('stub-OperatorReadinessCard')).toBeInTheDocument();
  });

  // ── (3) Governance panel shows BOTH GovernanceInbox AND OperatorReadinessCard ─
  it('governance panel renders GovernanceInbox AND OperatorReadinessCard stacked', () => {
    setup();
    expect(screen.getByText('stub-GovernanceInbox')).toBeInTheDocument();
    expect(screen.getByText('stub-OperatorReadinessCard')).toBeInTheDocument();
  });

  // ── (4) Clicking Users tab switches panel ─────────────────────────────────
  it('clicking Users tab shows UsersAdmin and hides governance panel', () => {
    setup();
    const usersTab = screen.getByRole('tab', { name: /users/i });
    fireEvent.click(usersTab);

    expect(usersTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /governance/i })).toHaveAttribute('aria-selected', 'false');

    expect(screen.getByText('stub-UsersAdmin')).toBeInTheDocument();

    // Governance panel hidden
    expect(screen.queryByText('stub-GovernanceInbox')).toBeNull();
    expect(screen.queryByText('stub-OperatorReadinessCard')).toBeNull();
  });

  // ── (5) Clicking Config tab ───────────────────────────────────────────────
  it('clicking Config tab shows BusinessConfigEditor', () => {
    setup();
    fireEvent.click(screen.getByRole('tab', { name: /config/i }));

    expect(screen.getByText('stub-BusinessConfigEditor')).toBeInTheDocument();
    expect(screen.queryByText('stub-GovernanceInbox')).toBeNull();
  });

  // ── (6) Clicking AML tab ─────────────────────────────────────────────────
  it('clicking AML tab shows AmlOps', () => {
    setup();
    fireEvent.click(screen.getByRole('tab', { name: /aml/i }));

    expect(screen.getByText('stub-AmlOps')).toBeInTheDocument();
    expect(screen.queryByText('stub-GovernanceInbox')).toBeNull();
  });

  // ── (7) Clicking Audit tab ───────────────────────────────────────────────
  it('clicking Audit tab shows AuditViewer', () => {
    setup();
    fireEvent.click(screen.getByRole('tab', { name: /audit/i }));

    expect(screen.getByText('stub-AuditViewer')).toBeInTheDocument();
    expect(screen.queryByText('stub-GovernanceInbox')).toBeNull();
  });

  // ── (8) Non-active tabs are aria-selected=false ───────────────────────────
  it('non-active tabs have aria-selected=false', () => {
    setup();
    expect(screen.getByRole('tab', { name: /users/i })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: /config/i })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: /aml/i })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: /audit/i })).toHaveAttribute('aria-selected', 'false');
  });
});
