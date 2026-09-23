import React, { useState } from 'react';
import { useReferralSummary, useClaimReferrals } from '../queries';
import { formatDisplay } from '../../../shared/money';
import { useTranslation, useErrorTranslation } from '../../../shared/i18n';
import { Button } from '../../../shared/ui';
import { ApiError, isApiError } from '../../../shared/api';

export function ReferralsDashboard() {
  const { locale } = useTranslation();
  const { tError } = useErrorTranslation();
  const summaryQuery = useReferralSummary();
  const claimMutation = useClaimReferrals();
  const [copied, setCopied] = useState(false);

  // A hardcoded referral link for the dashboard as requested (link/code display)
  const referralLink = 'https://exchange.example.com/register?ref=MYCODE';

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClaim = () => {
    claimMutation.mutate();
  };

  if (summaryQuery.isLoading) {
    return <div>Loading summary...</div>;
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return (
      <div>
        <p>Error loading referrals.</p>
        <Button onClick={() => summaryQuery.refetch()}>Retry</Button>
      </div>
    );
  }

  const { data } = summaryQuery;
  
  // Safe check for 0. '0', '0.00' etc. Canonical zero is typically '0'.
  const rawValue = data.pendingUsdt || '0';
  const numericString = rawValue.replace(/0+$/, '').replace(/\.$/, '');
  const isPendingZero = numericString === '0' || numericString === '' || rawValue === '0';
  
  const disableClaim = isPendingZero || claimMutation.isLoading;

  return (
    <div>
      <h1>Referrals</h1>
      
      <div>
        <p>Share your link:</p>
        <code>{referralLink}</code>
        <Button onClick={handleCopy}>{copied ? 'Copied!' : 'Copy'}</Button>
      </div>

      <div style={{ padding: '16px', border: '1px solid #ccc', margin: '16px 0' }}>
        <h2>Accrued commissions: {formatDisplay(data.pendingUsdt, { locale })} USDT</h2>
        <Button onClick={handleClaim} disabled={disableClaim}>
          Claim to Funding wallet
        </Button>

        {claimMutation.isError && (
          <p style={{ color: 'red' }}>
            {isApiError(claimMutation.error) 
              ? tError(claimMutation.error.code) 
              : 'Error claiming referrals.'}
          </p>
        )}
        
        {claimMutation.isSuccess && claimMutation.data && (
          <p style={{ color: 'green' }}>
            Successfully claimed {formatDisplay(claimMutation.data.amountClaimed, { locale })} {claimMutation.data.asset}.
          </p>
        )}
      </div>

      <div>
        <h3>Invited Users ({data.invitedCount})</h3>
        {data.invited.length === 0 ? (
          <p>No invited users yet.</p>
        ) : (
          <ul>
            {data.invited.map((user, i) => (
              <li key={i}>
                {user.email} (joined {new Date(user.createdAt).toLocaleDateString(locale)})
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
