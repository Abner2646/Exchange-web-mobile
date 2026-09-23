import React, { useState, useMemo } from 'react';
import QRCode from 'react-qr-code';
import { useTranslation } from '../../../shared/i18n';
import { useActiveCryptos, useDepositAddress } from '../queries';
import { CryptoCurrency } from '../api';
import styles from './DepositView.module.css';

export function DepositView() {
  const { t } = useTranslation();
  const { data: cryptos, isLoading: isLoadingCryptos, error: cryptosError } = useActiveCryptos();
  
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [selectedNetwork, setSelectedNetwork] = useState<string>('');

  const symbols = useMemo(() => {
    if (!cryptos) return [];
    const uniqueSymbols = Array.from(new Set(cryptos.map(c => c.symbol)));
    if (!selectedSymbol && uniqueSymbols.length > 0) {
      setSelectedSymbol(uniqueSymbols[0]);
    }
    return uniqueSymbols;
  }, [cryptos, selectedSymbol]);

  const availableNetworks = useMemo(() => {
    if (!cryptos || !selectedSymbol) return [];
    return cryptos
      .filter(c => c.symbol === selectedSymbol)
      .map(c => c.red || c.network || 'Unknown');
  }, [cryptos, selectedSymbol]);

  // Auto-select network when symbol changes
  React.useEffect(() => {
    if (availableNetworks.length > 0 && (!selectedNetwork || !availableNetworks.includes(selectedNetwork))) {
      setSelectedNetwork(availableNetworks[0]);
    }
  }, [availableNetworks, selectedNetwork]);

  const selectedCryptoId = useMemo(() => {
    if (!cryptos || !selectedSymbol || !selectedNetwork) return null;
    const crypto = cryptos.find(c => 
      c.symbol === selectedSymbol && 
      (c.red === selectedNetwork || c.network === selectedNetwork)
    );
    return crypto ? crypto.id : null;
  }, [cryptos, selectedSymbol, selectedNetwork]);

  const { data: addressData, isLoading: isLoadingAddress, error: addressError } = useDepositAddress(selectedCryptoId);

  const apiError = (addressError || cryptosError) as { code?: string; message?: string } | undefined;
  const errorCode = apiError?.code;
  const errorMessage = errorCode ? t(errorCode) : apiError?.message;

  const handleCopy = () => {
    if (addressData?.address) {
      navigator.clipboard.writeText(addressData.address);
      // Optional: show a toast or feedback here
    }
  };

  return (
    <div className={styles.depositContainer}>
      <h2>{t('DEPOSIT_TITLE') || 'Deposit'}</h2>
      
      {isLoadingCryptos && <p>{t('LOADING') || 'Loading...'}</p>}
      
      {!isLoadingCryptos && cryptos && (
        <div className={styles.selectors}>
          <div className={styles.formGroup}>
            <label htmlFor="crypto-select">{t('SELECT_CRYPTO') || 'Select Crypto:'}</label>
            <select 
              id="crypto-select"
              value={selectedSymbol} 
              onChange={e => setSelectedSymbol(e.target.value)}
            >
              {symbols.map(sym => (
                <option key={sym} value={sym}>{sym}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="network-select">{t('SELECT_NETWORK') || 'Select Network:'}</label>
            <select 
              id="network-select"
              value={selectedNetwork} 
              onChange={e => setSelectedNetwork(e.target.value)}
            >
              {availableNetworks.map(net => (
                <option key={net} value={net}>{net}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className={styles.addressSection}>
        {isLoadingAddress && <p>{t('LOADING_ADDRESS') || 'Loading address...'}</p>}
        {errorMessage && <p className={styles.error} role="alert">{errorMessage}</p>}
        
        {!isLoadingAddress && !errorMessage && addressData && (
          <div className={styles.addressCard}>
            <p className={styles.warningText}>
              {t('DEPOSIT_WARNING') || 'Send only this specific crypto and network to this address. Deposits appear as "Pending" until confirmed on-chain.'}
            </p>
            
            <div className={styles.qrCodeWrapper} data-testid="qr-code">
              <QRCode value={addressData.address} size={150} />
            </div>
            
            <div className={styles.addressDisplay}>
              <span className={styles.addressValue}>{addressData.address}</span>
              <button type="button" onClick={handleCopy} className={styles.copyBtn}>
                {t('COPY') || 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
