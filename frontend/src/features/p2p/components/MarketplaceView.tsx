import React, { useState } from 'react';
import { useOffers } from '../queries';
import { useTranslation, useErrorTranslation } from '../../../shared/i18n';
import { formatDisplay } from '../../../shared/money';
import { isApiError } from '../../../shared/api';
import { P2POfferFilters, P2POffer } from '../api';

import styles from './MarketplaceView.module.css';

export function MarketplaceView() {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();
  
  const [filters, setFilters] = useState<P2POfferFilters>({ type: 'buy' });
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');

  const { data, isLoading, error } = useOffers(filters);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'paymentMethod') {
      setPaymentMethodFilter(value);
      return;
    }
    
    setFilters((prev) => ({
      ...prev,
      [name]: value === '' ? undefined : value
    }));
  };

  const handleTabChange = (type: 'buy' | 'sell') => {
    setFilters((prev) => ({ ...prev, type }));
  };

  if (isLoading) {
    return <div data-testid="loading-state">{t('Loading')}...</div>;
  }

  if (error) {
    let msg = tError('FALLBACK_UNKNOWN_ERROR');
    if (isApiError(error)) {
      msg = tError(error.code);
    } else if (error && typeof (error as any).message === 'string') {
      msg = (error as any).message;
    }
    return <div data-testid="error-state">{msg}</div>;
  }

  let offers = data?.data || [];
  
  if (paymentMethodFilter) {
    offers = offers.filter(offer => 
      offer.paymentMethods.some(pm => 
        pm.name.toLowerCase().includes(paymentMethodFilter.toLowerCase()) || 
        pm.id === paymentMethodFilter
      )
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        <button 
          data-testid="tab-buy"
          onClick={() => handleTabChange('buy')} 
          disabled={filters.type === 'buy'}
        >
          Buy
        </button>
        <button 
          data-testid="tab-sell"
          onClick={() => handleTabChange('sell')} 
          disabled={filters.type === 'sell'}
        >
          Sell
        </button>
      </div>

      <div className={styles.filters}>
        <input 
          type="text"
          name="cryptoId"
          placeholder="Crypto ID"
          value={filters.cryptoId || ''}
          onChange={handleFilterChange}
          data-testid="filter-crypto"
        />
        <select 
          name="fiatCurrency" 
          value={filters.fiatCurrency || ''} 
          onChange={handleFilterChange}
          data-testid="filter-fiat"
        >
          <option value="">All Fiat</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
        <input 
          type="text"
          name="paymentMethod"
          placeholder="Payment Method"
          value={paymentMethodFilter}
          onChange={handleFilterChange}
          data-testid="filter-payment-method"
        />
      </div>

      {offers.length === 0 ? (
        <div data-testid="empty-state">{t('No offers')}</div>
      ) : (
        <div data-testid="success-state" className={styles.offersList}>
          {offers.map((offer: P2POffer) => (
            <div key={offer.id} className={styles.offerCard} data-testid={`offer-card-${offer.id}`}>
              <div className={styles.merchantInfo}>
                <span data-testid="merchant-reputation">User: {offer.userId}</span>
              </div>
              <div className={styles.priceInfo}>
                <span>Price: <span data-testid="offer-price">{formatDisplay(offer.unitPrice, { locale })}</span> {offer.fiatCurrency}</span>
              </div>
              <div className={styles.limitsInfo}>
                <span>Limits: {formatDisplay(offer.minAmount, { locale })} - {formatDisplay(offer.maxAmount, { locale })}</span>
              </div>
              <div className={styles.paymentMethods}>
                {offer.paymentMethods.map(pm => (
                  <span key={pm.id} className={styles.tag}>{pm.name}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
