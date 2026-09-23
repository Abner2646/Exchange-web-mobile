import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ReferralsDashboard } from './ReferralsDashboard';
import * as api from '../api';
import { ApiError } from '../../../shared/api';
import { LocaleProvider } from '../../../shared/i18n/LocaleContext';
import type { CanonicalAmount } from '../../../shared/money';

jest.mock('../api');

const mockedApi = api as jest.Mocked<typeof api>;

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <LocaleProvider>
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    </LocaleProvider>
  );
};

describe('ReferralsDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('loading state initially', () => {
    mockedApi.fetchReferralSummary.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<ReferralsDashboard />);
    expect(screen.getByText('Loading summary...')).toBeInTheDocument();
  });

  test('success renders the accrued amount formatted and the invited list', async () => {
    mockedApi.fetchReferralSummary.mockResolvedValue({
      pendingUsdt: '12.50' as CanonicalAmount,
      invitedCount: 1,
      invited: [{ email: 't***@example.com', createdAt: '2026-09-23T00:00:00Z' }]
    });

    renderWithProviders(<ReferralsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Accrued commissions:/)).toBeInTheDocument();
    });

    expect(screen.getByText(/12\.50/)).toBeInTheDocument();
    expect(screen.getByText(/t\*\*\*@example\.com/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Claim to Funding wallet' })).toBeEnabled();
  });

  test('claim button is disabled when pending balance is zero', async () => {
    mockedApi.fetchReferralSummary.mockResolvedValue({
      pendingUsdt: '0' as CanonicalAmount,
      invitedCount: 0,
      invited: []
    });

    renderWithProviders(<ReferralsDashboard />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Claim to Funding wallet' })).toBeDisabled();
    });
  });

  test('clicking claim calls the claim API, disables the button while pending, and refetches summary', async () => {
    mockedApi.fetchReferralSummary.mockResolvedValue({
      pendingUsdt: '10.00' as CanonicalAmount,
      invitedCount: 0,
      invited: []
    });
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolveClaim: any;
    mockedApi.claimReferrals.mockReturnValue(new Promise((res) => {
      resolveClaim = res;
    }));

    renderWithProviders(<ReferralsDashboard />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Claim to Funding wallet' })).toBeEnabled();
    });

    const button = screen.getByRole('button', { name: 'Claim to Funding wallet' });
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
    });
    expect(mockedApi.claimReferrals).toHaveBeenCalled();

    resolveClaim({ amountClaimed: '10.00' as CanonicalAmount, asset: 'USDT' });

    await waitFor(() => {
      expect(screen.getByText(/Successfully claimed/)).toBeInTheDocument();
    });

    // React query invalidation causes refetch
    // Wait for the refetch to be called
    await waitFor(() => {
      expect(mockedApi.fetchReferralSummary).toHaveBeenCalledTimes(2);
    });
  });

  test('claim error renders a mapped message', async () => {
    mockedApi.fetchReferralSummary.mockResolvedValue({
      pendingUsdt: '10.00' as CanonicalAmount,
      invitedCount: 0,
      invited: []
    });
    
    const apiError = new ApiError({ code: 'VALIDATION_ERROR' });
    mockedApi.claimReferrals.mockRejectedValue(apiError);

    renderWithProviders(<ReferralsDashboard />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Claim to Funding wallet' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Claim to Funding wallet' }));

    await waitFor(() => {
      // 'FALLBACK_UNKNOWN_ERROR': 'An unknown error occurred (Code: {{code}}).'
      expect(screen.getByText(/Code: VALIDATION_ERROR/i)).toBeInTheDocument();
    });
  });
});
