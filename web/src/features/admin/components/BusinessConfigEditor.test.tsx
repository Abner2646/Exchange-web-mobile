// web/src/features/admin/components/BusinessConfigEditor.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';
import { BusinessConfigEditor } from './BusinessConfigEditor';

// ── Hoisted mock fns ──────────────────────────────────────────────────────────

const mutateUpsert = vi.fn();
const useConfigMock = vi.fn();
const useUpsertConfigMock = vi.fn();

vi.mock('../queries', () => ({
  useConfig: (category?: string) => useConfigMock(category),
  useUpsertConfig: () => useUpsertConfigMock(),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_CONFIG_ITEMS = [
  {
    key: 'max_withdrawal_usd',
    value: '10000',
    type: 'number',
    category: 'withdrawals',
    description: 'Maximum withdrawal in USD',
  },
  {
    key: 'kyc_required',
    value: 'true',
    type: 'boolean',
    category: 'kyc',
    description: 'Whether KYC is required',
  },
];

function makeMutationMock(
  mutateFn: ReturnType<typeof vi.fn>,
  options?: { isPending?: boolean; isError?: boolean; error?: unknown; isSuccess?: boolean },
) {
  return {
    mutate: mutateFn,
    isPending: options?.isPending ?? false,
    isError: options?.isError ?? false,
    isSuccess: options?.isSuccess ?? false,
    error: options?.error ?? null,
  };
}

function defaultSetup() {
  useConfigMock.mockReturnValue({
    data: { data: MOCK_CONFIG_ITEMS },
    isLoading: false,
    isError: false,
    error: null,
  });
  useUpsertConfigMock.mockReturnValue(makeMutationMock(mutateUpsert));
}

beforeEach(() => {
  vi.clearAllMocks();
  defaultSetup();
});

function setup() {
  return render(
    <LocaleProvider>
      <BusinessConfigEditor />
    </LocaleProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BusinessConfigEditor — row rendering', () => {
  it('renders a config row with key, value, and type visible', () => {
    setup();
    expect(screen.getByText('max_withdrawal_usd')).toBeInTheDocument();
    expect(screen.getByText('10000')).toBeInTheDocument();
    expect(screen.getByText('number')).toBeInTheDocument();
  });

  it('renders all rows from useConfig data', () => {
    setup();
    expect(screen.getByText('kyc_required')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
  });
});

describe('BusinessConfigEditor — loading state', () => {
  it('renders loading indicator when isLoading', () => {
    useConfigMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });
    setup();
    expect(screen.getByText(/Loading\.\.\./i)).toBeInTheDocument();
  });
});

describe('BusinessConfigEditor — error state', () => {
  it('renders fetch error when isError', () => {
    useConfigMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { code: 'INTERNAL_ERROR' },
    });
    setup();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('BusinessConfigEditor — empty state', () => {
  it('renders empty state when data is empty', () => {
    useConfigMock.mockReturnValue({
      data: { data: [] },
      isLoading: false,
      isError: false,
      error: null,
    });
    setup();
    // Should render no rows — table is empty or shows empty state
    expect(screen.queryByRole('row', { name: /max_withdrawal/ })).not.toBeInTheDocument();
  });
});

describe('BusinessConfigEditor — inline edit and save', () => {
  it('clicking Edit on a row shows an editable input for the value', () => {
    setup();
    // Click the first Edit button
    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editBtns[0]);
    // The value field should now be an input
    const inputs = screen.getAllByRole('textbox');
    const valueInput = inputs.find((el) => (el as HTMLInputElement).value === '10000');
    expect(valueInput).toBeDefined();
  });

  it('editing the value and saving calls useUpsertConfig().mutate with { key, body: { value, type, ... } }', async () => {
    setup();
    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editBtns[0]);

    // Find the value input (contains '10000') and update it
    const inputs = screen.getAllByRole('textbox');
    const valueInput = inputs.find((el) => (el as HTMLInputElement).value === '10000')!;
    fireEvent.change(valueInput, { target: { value: '20000' } });

    // Click Save
    const saveBtns = screen.getAllByRole('button', { name: /Save/i });
    fireEvent.click(saveBtns[0]);

    await waitFor(() => expect(mutateUpsert).toHaveBeenCalled());
    expect(mutateUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'max_withdrawal_usd',
        body: expect.objectContaining({
          value: '20000',  // string — NOT a number
          type: 'number',
        }),
      }),
      expect.anything(),
    );
  });

  it('value is sent as a STRING even when type is "number" (no numeric coercion)', async () => {
    setup();
    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editBtns[0]);

    const inputs = screen.getAllByRole('textbox');
    const valueInput = inputs.find((el) => (el as HTMLInputElement).value === '10000')!;
    fireEvent.change(valueInput, { target: { value: '99999' } });

    const saveBtns = screen.getAllByRole('button', { name: /Save/i });
    fireEvent.click(saveBtns[0]);

    await waitFor(() => expect(mutateUpsert).toHaveBeenCalled());
    const callArgs = mutateUpsert.mock.calls[0][0];
    // value MUST be a string — typeof check
    expect(typeof callArgs.body.value).toBe('string');
    expect(callArgs.body.value).toBe('99999');
  });

  it('Save is disabled when value is empty (trimmed)', () => {
    setup();
    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editBtns[0]);

    const inputs = screen.getAllByRole('textbox');
    const valueInput = inputs.find((el) => (el as HTMLInputElement).value === '10000')!;
    fireEvent.change(valueInput, { target: { value: '   ' } });

    const saveBtns = screen.getAllByRole('button', { name: /Save/i });
    expect(saveBtns[0]).toBeDisabled();
  });

  it('Save is disabled while isPending', () => {
    useUpsertConfigMock.mockReturnValue(makeMutationMock(mutateUpsert, { isPending: true }));
    setup();
    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editBtns[0]);

    const saveBtns = screen.getAllByRole('button', { name: /Save/i });
    expect(saveBtns[0]).toBeDisabled();
  });
});

describe('BusinessConfigEditor — error display on save', () => {
  it('renders tError with role="alert" when mutation has CONFIG_INVALID_INPUT error', () => {
    useUpsertConfigMock.mockReturnValue(
      makeMutationMock(mutateUpsert, {
        isError: true,
        error: { code: 'CONFIG_INVALID_INPUT', requestId: 'rid-cfg-1' },
      }),
    );
    setup();
    // Open edit mode to show the error
    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editBtns[0]);

    // CONFIG_INVALID_INPUT alert should be visible
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    // Should contain the translated message
    expect(alert.textContent).toMatch(/Invalid configuration input/i);
  });
});

describe('BusinessConfigEditor — category filter', () => {
  it('passes the category value to useConfig when filter is set', () => {
    setup();
    // Find the category filter input
    const filterInput = screen.getByLabelText(/Filter by category/i);
    fireEvent.change(filterInput, { target: { value: 'withdrawals' } });

    // useConfig should have been called with 'withdrawals'
    expect(useConfigMock).toHaveBeenCalledWith('withdrawals');
  });

  it('passes undefined to useConfig when the filter is empty', () => {
    setup();
    // Initial render — no filter value → undefined
    expect(useConfigMock).toHaveBeenCalledWith(undefined);
  });
});

describe('BusinessConfigEditor — success indicator', () => {
  it('shows "Configuration saved." after a successful upsert', () => {
    useUpsertConfigMock.mockReturnValue(
      makeMutationMock(mutateUpsert, { isSuccess: true }),
    );
    setup();
    // Open edit on any row to see saved indicator
    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editBtns[0]);
    expect(screen.getByText('Configuration saved.')).toBeInTheDocument();
  });
});
