// web/src/features/admin/components/AmlOps.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';
import { AmlOps } from './AmlOps';

// ── Hoisted mock fns ──────────────────────────────────────────────────────────

const mutateSetAmlConfig = vi.fn();
const mutateAddDenylist = vi.fn();
const mutateRemoveDenylist = vi.fn();
const mutateResolveCase = vi.fn();

const useAmlConfigMock = vi.fn();
const useSetAmlConfigMock = vi.fn();
const useDenylistMock = vi.fn();
const useAddDenylistMock = vi.fn();
const useRemoveDenylistMock = vi.fn();
const useCasesMock = vi.fn();
const useResolveCaseMock = vi.fn();

vi.mock('../queries', () => ({
  useAmlConfig: () => useAmlConfigMock(),
  useSetAmlConfig: () => useSetAmlConfigMock(),
  useDenylist: () => useDenylistMock(),
  useAddDenylist: () => useAddDenylistMock(),
  useRemoveDenylist: () => useRemoveDenylistMock(),
  useCases: (status?: string) => useCasesMock(status),
  useResolveCase: () => useResolveCaseMock(),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_AML_CONFIG = {
  monitoringEnabled: true,
  holdEnforcementEnabled: false,
};

const MOCK_DENYLIST = [
  { id: 'dl-1', address: '0xdeadbeef', network: 'ETH', reason: 'Sanctions', source: 'OFAC' },
  { id: 'dl-2', address: '1ABC...xyz', network: 'BTC', reason: null, source: null },
];

const MOCK_CASES = [
  { id: 'case-1', status: 'open', signalId: 'sig-001', evidence: {}, created_at: '2026-10-12T10:00:00Z' },
  { id: 'case-2', status: 'resolved', signalId: 'sig-002', evidence: {}, created_at: '2026-10-10T09:00:00Z' },
];

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
  useAmlConfigMock.mockReturnValue({
    data: MOCK_AML_CONFIG,
    isLoading: false,
    isError: false,
    error: null,
  });
  useSetAmlConfigMock.mockReturnValue(makeMutationMock(mutateSetAmlConfig));
  useDenylistMock.mockReturnValue({
    data: MOCK_DENYLIST,
    isLoading: false,
    isError: false,
    error: null,
  });
  useAddDenylistMock.mockReturnValue(makeMutationMock(mutateAddDenylist));
  useRemoveDenylistMock.mockReturnValue(makeMutationMock(mutateRemoveDenylist));
  useCasesMock.mockReturnValue({
    data: MOCK_CASES,
    isLoading: false,
    isError: false,
    error: null,
  });
  useResolveCaseMock.mockReturnValue(makeMutationMock(mutateResolveCase));
}

beforeEach(() => {
  vi.clearAllMocks();
  defaultSetup();
});

function setup() {
  return render(
    <LocaleProvider>
      <AmlOps />
    </LocaleProvider>,
  );
}

// ── Config toggles ─────────────────────────────────────────────────────────────

describe('AmlOps — config toggles', () => {
  it('renders the monitoring toggle button', () => {
    setup();
    // The i18n key admin.aml.monitoring.toggle = "AML monitoring"
    expect(screen.getByText(/AML monitoring/i)).toBeInTheDocument();
  });

  it('renders the hold enforcement toggle button', () => {
    setup();
    // The i18n key admin.aml.holdEnforcement.toggle = "Hold enforcement"
    expect(screen.getByText(/Hold enforcement/i)).toBeInTheDocument();
  });

  it('toggling monitoring (currently enabled=true) calls mutate with key="aml.monitoring.enabled" value="false"', async () => {
    // monitoringEnabled = true → clicking toggle should send value='false'
    setup();
    const toggleBtns = screen.getAllByRole('button', { name: /AML monitoring/i });
    fireEvent.click(toggleBtns[0]);
    await waitFor(() => expect(mutateSetAmlConfig).toHaveBeenCalled());
    const firstCallArgs = mutateSetAmlConfig.mock.calls[0][0];
    expect(firstCallArgs).toEqual({ key: 'aml.monitoring.enabled', value: 'false' });
  });

  it('toggling holdEnforcement (currently enabled=false) calls mutate with key="aml.holdEnforcement.enabled" value="true"', async () => {
    // holdEnforcementEnabled = false → clicking toggle should send value='true'
    setup();
    const toggleBtns = screen.getAllByRole('button', { name: /Hold enforcement/i });
    fireEvent.click(toggleBtns[0]);
    await waitFor(() => expect(mutateSetAmlConfig).toHaveBeenCalled());
    const firstCallArgs = mutateSetAmlConfig.mock.calls[0][0];
    expect(firstCallArgs).toEqual({ key: 'aml.holdEnforcement.enabled', value: 'true' });
  });

  it('toggle buttons are disabled while mutation isPending', () => {
    useSetAmlConfigMock.mockReturnValue(makeMutationMock(mutateSetAmlConfig, { isPending: true }));
    setup();
    const toggleBtns = screen.getAllByRole('button', { name: /AML monitoring/i });
    expect(toggleBtns[0]).toBeDisabled();
  });

  it('renders loading state for AML config', () => {
    useAmlConfigMock.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null });
    setup();
    expect(screen.getByText(/Loading\.\.\./i)).toBeInTheDocument();
  });
});

// ── Denylist ───────────────────────────────────────────────────────────────────

describe('AmlOps — denylist', () => {
  it('renders denylist entries', () => {
    setup();
    expect(screen.getByText('0xdeadbeef')).toBeInTheDocument();
    expect(screen.getByText('1ABC...xyz')).toBeInTheDocument();
  });

  it('renders the network for each denylist entry', () => {
    setup();
    expect(screen.getByText('ETH')).toBeInTheDocument();
    expect(screen.getByText('BTC')).toBeInTheDocument();
  });

  it('adding an entry sends { address, network } to mutate', async () => {
    setup();

    const addressInputs = screen.getAllByLabelText(/Address/i);
    const networkInputs = screen.getAllByLabelText(/Network/i);

    // Use the first address/network inputs (the add form)
    fireEvent.change(addressInputs[0], { target: { value: '0xnewaddr' } });
    fireEvent.change(networkInputs[0], { target: { value: 'ETH' } });

    const addBtn = screen.getByRole('button', { name: /Add to denylist/i });
    fireEvent.click(addBtn);

    await waitFor(() => expect(mutateAddDenylist).toHaveBeenCalled());
    expect(mutateAddDenylist).toHaveBeenCalledWith(
      expect.objectContaining({ address: '0xnewaddr', network: 'ETH' }),
      expect.anything(),
    );
  });

  it('optional reason and source are included when filled', async () => {
    setup();

    const addressInputs = screen.getAllByLabelText(/Address/i);
    const networkInputs = screen.getAllByLabelText(/Network/i);
    const reasonInputs = screen.getAllByLabelText(/Reason/i);
    const sourceInputs = screen.getAllByLabelText(/Source/i);

    fireEvent.change(addressInputs[0], { target: { value: '0xfoo' } });
    fireEvent.change(networkInputs[0], { target: { value: 'BTC' } });
    fireEvent.change(reasonInputs[0], { target: { value: 'Fraud' } });
    fireEvent.change(sourceInputs[0], { target: { value: 'Manual' } });

    const addBtn = screen.getByRole('button', { name: /Add to denylist/i });
    fireEvent.click(addBtn);

    await waitFor(() => expect(mutateAddDenylist).toHaveBeenCalled());
    expect(mutateAddDenylist).toHaveBeenCalledWith(
      { address: '0xfoo', network: 'BTC', reason: 'Fraud', source: 'Manual' },
      expect.anything(),
    );
  });

  it('remove button calls useRemoveDenylist().mutate(id)', async () => {
    setup();
    const removeBtns = screen.getAllByRole('button', { name: /Remove/i });
    fireEvent.click(removeBtns[0]);
    await waitFor(() => expect(mutateRemoveDenylist).toHaveBeenCalled());
    expect(mutateRemoveDenylist.mock.calls[0][0]).toBe('dl-1');
  });

  it('remove buttons are disabled while mutation isPending', () => {
    useRemoveDenylistMock.mockReturnValue(makeMutationMock(mutateRemoveDenylist, { isPending: true }));
    setup();
    const removeBtns = screen.getAllByRole('button', { name: /Remove/i });
    removeBtns.forEach((btn) => expect(btn).toBeDisabled());
  });

  it('renders empty denylist state', () => {
    useDenylistMock.mockReturnValue({ data: [], isLoading: false, isError: false, error: null });
    setup();
    expect(screen.queryByText('0xdeadbeef')).not.toBeInTheDocument();
  });
});

// ── Cases ──────────────────────────────────────────────────────────────────────

describe('AmlOps — cases', () => {
  it('renders case IDs and statuses', () => {
    setup();
    expect(screen.getByText('case-1')).toBeInTheDocument();
    // 'open' appears both in the <option> and the status span — use getAllByText
    expect(screen.getAllByText('open').length).toBeGreaterThan(0);
  });

  it('renders the signalId for each case', () => {
    setup();
    expect(screen.getByText('sig-001')).toBeInTheDocument();
  });

  it('clicking approve button opens the resolve dialog', () => {
    setup();
    const approveBtns = screen.getAllByRole('button', { name: /Release funds/i });
    fireEvent.click(approveBtns[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('the resolve dialog shows the resolve explanation', () => {
    setup();
    const approveBtns = screen.getAllByRole('button', { name: /Release funds/i });
    fireEvent.click(approveBtns[0]);
    // admin.aml.cases.resolveExplanation = "Approve to release the held funds back to the user. Reject to refund..."
    expect(screen.getByText(/Approve to release the held funds back to the user/i)).toBeInTheDocument();
  });

  it('confirming approve sends { id, decision: "approve" } to mutate', async () => {
    setup();
    const approveBtns = screen.getAllByRole('button', { name: /Release funds/i });
    fireEvent.click(approveBtns[0]);

    // Find confirm button inside dialog
    const allReleaseBtns = screen.getAllByRole('button', { name: /Release funds/i });
    fireEvent.click(allReleaseBtns[allReleaseBtns.length - 1]);

    await waitFor(() => expect(mutateResolveCase).toHaveBeenCalled());
    expect(mutateResolveCase).toHaveBeenCalledWith(
      { id: 'case-1', decision: 'approve' },
      expect.anything(),
    );
  });

  it('clicking reject button opens the resolve dialog and confirming sends decision="reject"', async () => {
    setup();
    const rejectBtns = screen.getAllByRole('button', { name: /Refund & close/i });
    fireEvent.click(rejectBtns[0]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const allRejectBtns = screen.getAllByRole('button', { name: /Refund & close/i });
    fireEvent.click(allRejectBtns[allRejectBtns.length - 1]);

    await waitFor(() => expect(mutateResolveCase).toHaveBeenCalled());
    expect(mutateResolveCase).toHaveBeenCalledWith(
      { id: 'case-1', decision: 'reject' },
      expect.anything(),
    );
  });

  it('a 409 already-resolved error renders with role="alert"', () => {
    useResolveCaseMock.mockReturnValue(
      makeMutationMock(mutateResolveCase, {
        isError: true,
        error: { code: 'AML_CASE_ALREADY_RESOLVED', requestId: 'rid-aml-1' },
      }),
    );
    setup();
    // Open a resolve dialog to show the error
    const approveBtns = screen.getAllByRole('button', { name: /Release funds/i });
    fireEvent.click(approveBtns[0]);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('status filter passes the status value to useCases', () => {
    setup();
    const filterSelect = screen.getByLabelText(/Filter by status/i);
    fireEvent.change(filterSelect, { target: { value: 'open' } });
    expect(useCasesMock).toHaveBeenCalledWith('open');
  });

  it('renders empty cases state', () => {
    useCasesMock.mockReturnValue({ data: [], isLoading: false, isError: false, error: null });
    setup();
    expect(screen.queryByText('case-1')).not.toBeInTheDocument();
  });
});
