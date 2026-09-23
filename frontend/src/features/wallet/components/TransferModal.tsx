import React, { useState, useEffect } from 'react';
import { Dialog, Field, Button } from '../../../shared/ui';
import { useTranslation, useErrorTranslation } from '../../../shared/i18n';
import { parseInput, formatDisplay, gt, lte, CanonicalAmount, isPositive } from '../../../shared/money';
import { useInternalTransfer, useBalances } from '../queries';
import { isApiError } from '../../../shared/api';
import styles from './TransferModal.module.css';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({ isOpen, onClose }) => {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();
  
  const { data: balances } = useBalances();
  const { mutate, isLoading, error, isSuccess, reset } = useInternalTransfer();

  const [assetId, setAssetId] = useState<string>('');
  const [origen, setOrigen] = useState<'funding' | 'spot'>('funding');
  const [destino, setDestino] = useState<'funding' | 'spot'>('spot');
  const [rawAmount, setRawAmount] = useState<string>('');
  
  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAssetId('');
      setOrigen('funding');
      setDestino('spot');
      setRawAmount('');
      reset();
    }
  }, [isOpen, reset]);

  // Handle default asset selection if available
  useEffect(() => {
    if (isOpen && balances && balances.length > 0 && !assetId) {
      setAssetId(balances[0].id);
    }
  }, [isOpen, balances, assetId]);

  const selectedAsset = balances?.find(b => b.id === assetId);

  let availableAmount: CanonicalAmount = '0' as CanonicalAmount;
  if (selectedAsset) {
    availableAmount = origen === 'funding' ? selectedAsset.funding.available : selectedAsset.spot.available;
  }

  const handleMaxClick = () => {
    if (selectedAsset) {
      setRawAmount(availableAmount);
    }
  };

  const handleSwapCompartments = () => {
    setOrigen(destino);
    setDestino(origen);
  };

  let inputError = '';
  let parsedAmount: CanonicalAmount | null = null;
  
  if (rawAmount) {
    const parsed = parseInput(rawAmount, { locale });
    if (!parsed.ok) {
      inputError = t('Invalid amount format');
    } else {
      parsedAmount = parsed.value;
      if (!isPositive(parsedAmount)) {
        inputError = t('Amount must be greater than zero');
      } else if (gt(parsedAmount, availableAmount)) {
        inputError = t('Insufficient available balance');
      }
    }
  }

  const isFormValid = !!(assetId && parsedAmount && !inputError && origen !== destino);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !parsedAmount) return;
    
    mutate({
      criptomonedaId: assetId,
      cantidad: parsedAmount,
      origen,
      destino
    });
  };

  const modalContent = (
    <div>
      {isSuccess ? (
        <div data-testid="transfer-success" className={styles.success}>
          <h3>{t('Transfer successful')}</h3>
          <Button onClick={onClose} data-testid="close-btn">{t('Close')}</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <>
            {error && (
              <div data-testid="transfer-error" className={styles.apiError}>
                {isApiError(error) ? tError(error.code) : tError('FALLBACK_UNKNOWN_ERROR')}
              </div>
            )}

            <div className={styles.fieldGroup}>
              <label htmlFor="asset-select" className={styles.label}>{t('Asset')}</label>
              <select
                id="asset-select"
                data-testid="asset-select"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                className={styles.select}
                disabled={isLoading}
              >
                <option value="" disabled>{t('Select an asset')}</option>
                {balances?.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.symbol})</option>
                ))}
              </select>
            </div>

            <div className={styles.compartments}>
              <div className={styles.fieldGroup}>
                <label htmlFor="origen-select" className={styles.label}>{t('From')}</label>
                <select
                  id="origen-select"
                  data-testid="origen-select"
                  value={origen}
                  onChange={(e) => setOrigen(e.target.value as 'funding' | 'spot')}
                  className={styles.select}
                  disabled={isLoading}
                >
                  <option value="funding">Funding</option>
                  <option value="spot">Spot</option>
                </select>
              </div>

              <Button type="button" onClick={handleSwapCompartments} disabled={isLoading} data-testid="swap-btn" className={styles.swapBtn}>
                ↔
              </Button>

              <div className={styles.fieldGroup}>
                <label htmlFor="destino-select" className={styles.label}>{t('To')}</label>
                <select
                  id="destino-select"
                  data-testid="destino-select"
                  value={destino}
                  onChange={(e) => setDestino(e.target.value as 'funding' | 'spot')}
                  className={styles.select}
                  disabled={isLoading}
                >
                  <option value="funding">Funding</option>
                  <option value="spot">Spot</option>
                </select>
              </div>
            </div>
            
            {origen === destino && (
              <div className={styles.errorText} data-testid="same-compartment-error">
                {t('Origin and destination must differ')}
              </div>
            )}

            <div className={styles.amountSection}>
              <Field
                label={t('Amount')}
                id="amount-input"
                data-testid="amount-input"
                value={rawAmount}
                onChange={(e) => setRawAmount(e.target.value)}
                error={inputError}
                disabled={isLoading}
              />
              
              <div className={styles.availableRow}>
                <span>
                  {t('Available')}: {selectedAsset ? formatDisplay(availableAmount, { locale }) : '0'} {selectedAsset?.symbol}
                </span>
                <Button type="button" onClick={handleMaxClick} disabled={isLoading || !selectedAsset} data-testid="max-btn" className={styles.maxBtn}>
                  {t('Max')}
                </Button>
              </div>
            </div>

            <div className={styles.actions}>
              <Button type="submit" disabled={!isFormValid || isLoading} data-testid="submit-transfer-btn">
                {isLoading ? t('Processing...') : t('Transfer')}
              </Button>
            </div>
          </>
        </form>
      )}
    </div>
  );

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={t('Internal Transfer')}>
      {modalContent}
    </Dialog>
  );
};
