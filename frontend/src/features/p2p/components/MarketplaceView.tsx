import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOffers, useStartTrade } from '../queries';
import { useTranslation, useErrorTranslation } from '../../../shared/i18n';
import { formatDisplay, parseInput, gt, lte, CanonicalAmount, isPositive } from '../../../shared/money';
import { isApiError } from '../../../shared/api';
import { P2POfferFilters, P2POffer } from '../api';
import { Dialog, Button, Field } from '../../../shared/ui';

import styles from './MarketplaceView.module.css';

export function MarketplaceView() {
  const navigate = useNavigate();
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();
  
  const [filters, setFilters] = useState<P2POfferFilters>({ type: 'buy' });
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');

  const { data, isLoading, error } = useOffers(filters);
  const startTrade = useStartTrade();

  const [selectedOffer, setSelectedOffer] = useState<P2POffer | null>(null);
  const [amountInput, setAmountInput] = useState('');

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

  const handleStartTrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOffer) return;

    const parsed = parseInput(amountInput, { locale });
    if (!parsed.ok || !isPositive(parsed.value)) return;

    startTrade.mutate(
      { 
        offerId: selectedOffer.id, 
        amount: parsed.value,
        paymentMethodId: selectedOffer.paymentMethods[0]?.id 
      },
      {
        onSuccess: (tx) => {
          setSelectedOffer(null);
          navigate(`/p2p/trade/${tx.id}`);
        }
      }
    );
  };

  let parsedAmount: CanonicalAmount | null = null;
  let amountError = '';
  if (selectedOffer && amountInput) {
    const parsed = parseInput(amountInput, { locale });
    if (!parsed.ok) {
      amountError = t('Invalid amount format');
    } else {
      parsedAmount = parsed.value;
      if (!isPositive(parsedAmount)) {
        amountError = t('Amount must be greater than zero');
      } else if (gt(parsedAmount, selectedOffer.maxAmount) || gt(selectedOffer.minAmount, parsedAmount)) {
        amountError = t('Amount out of range');
      }
    }
  }

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
              <div className={styles.offerActions} style={{ marginTop: '1rem' }}>
                <Button onClick={() => { setSelectedOffer(offer); setAmountInput(""); }} data-testid={`btn-start-trade-${offer.id}`}>
                  {t('Start Trade')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog 
        isOpen={!!selectedOffer} 
        onClose={() => setSelectedOffer(null)} 
        title={t('Start Trade')}
      >
        <form onSubmit={handleStartTrade}>
          {startTrade.error && (
            <div style={{ color: 'red', marginBottom: '1rem' }}>
              {isApiError(startTrade.error) ? tError(startTrade.error.code) : tError('UNKNOWN_ERROR')}
            </div>
          )}
          <Field 
            id="amount-input"
            label={t('Amount')}
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            error={amountError}
            disabled={startTrade.isLoading}
          />
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => setSelectedOffer(null)} disabled={startTrade.isLoading}>
              {t('Cancel')}
            </Button>
            <Button type="submit" disabled={startTrade.isLoading || !!amountError || !parsedAmount} data-testid="btn-submit-trade">
              {startTrade.isLoading ? t('Loading...') : t('Confirm')}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
