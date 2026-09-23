import React, { useState } from 'react';
import { useBalances } from '../queries';
import { useTranslation, useErrorTranslation } from '../../../shared/i18n';
import { formatDisplay } from '../../../shared/money';
import { Button } from '../../../shared/ui';
import { isApiError } from '../../../shared/api';

import styles from './BalancesView.module.css';

export function BalancesView() {
  const { data: balances, isLoading, error } = useBalances();
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();
  const [tab, setTab] = useState<'funding' | 'spot'>('funding');

  if (isLoading) {
    return <div data-testid="loading-state">{t('Loading')}...</div>;
  }

  if (error) {
    let msg = tError('FALLBACK_UNKNOWN_ERROR');
    if (isApiError(error)) {
      msg = tError(error.code);
    } else if (error instanceof Error) {
      msg = error.message;
    }
    return <div data-testid="error-state">{msg}</div>;
  }

  if (!balances || balances.length === 0) {
    return <div data-testid="empty-state">{t('No balances')}</div>;
  }

  return (
    <div data-testid="success-state" className={styles.container}>
      <div className={styles.tabs}>
        <Button 
          data-testid="tab-funding"
          onClick={() => setTab('funding')} 
          disabled={tab === 'funding'}
        >
          Funding
        </Button>
        <Button 
          data-testid="tab-spot"
          onClick={() => setTab('spot')} 
          disabled={tab === 'spot'}
        >
          Spot
        </Button>
      </div>

      <div className={styles.balancesList}>
        {balances.map((b) => (
          <div key={b.id} className={styles.balanceItem} data-testid={`balance-item-${b.symbol}`}>
            <h3>{b.name} ({b.symbol})</h3>
            {tab === 'funding' && (
              <ul>
                <li>Available: {formatDisplay(b.funding.available, { locale })}</li>
                <li>Blocked: {formatDisplay(b.funding.blocked, { locale })}</li>
                <li>Pending: {formatDisplay(b.funding.pending, { locale })}</li>
              </ul>
            )}
            {tab === 'spot' && (
              <ul>
                <li>Available: {formatDisplay(b.spot.available, { locale })}</li>
                <li>Blocked: {formatDisplay(b.spot.blocked, { locale })}</li>
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
