import React, { useState, useMemo } from 'react';
import { parseInput, formatDisplay, CanonicalAmount } from '../../../shared/money';
import { useTranslation } from '../../../shared/i18n';
import { Field, Button } from '../../../shared/ui';
import { useSwapPreview } from '../queries';
import { CalculateSwapRequest } from '../api';
import { SwapConfirmModal } from './SwapConfirmModal';

export function SwapWidget() {
  const { t, locale } = useTranslation();
  const [from, setFrom] = useState('BTC');
  const [to, setTo] = useState('USDT');
  const [rawAmount, setRawAmount] = useState('');
  const [source, setSource] = useState<'funding' | 'spot'>('funding');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const parseResult = useMemo(() => {
    if (!rawAmount) return { ok: false as const, error: 'EMPTY' };
    return parseInput(rawAmount, { locale });
  }, [rawAmount, locale]);

  const isValidAmount = parseResult.ok && parseResult.value;

  const previewParams: CalculateSwapRequest | null = isValidAmount ? {
    from,
    to,
    amount: parseResult.value as CanonicalAmount,
    source
  } : null;

  const { data: preview, isLoading, error } = useSwapPreview(previewParams);

  const apiError = error as { code?: string; message?: string } | undefined;
  const errorCode = apiError?.code;
  const errorMessage = errorCode ? t(errorCode) : apiError?.message;

  return (
    <div className="swap-widget">
      <h2>Swap (Preview Only)</h2>
      
      <div className="assets">
        <label>
          From:
          <select value={from} onChange={e => setFrom(e.target.value)}>
            <option value="BTC">BTC</option>
            <option value="ETH">ETH</option>
            <option value="USDT">USDT</option>
          </select>
        </label>
        
        <label>
          To:
          <select value={to} onChange={e => setTo(e.target.value)}>
            <option value="USDT">USDT</option>
            <option value="BTC">BTC</option>
            <option value="ETH">ETH</option>
          </select>
        </label>
      </div>

      <div className="source-wallet">
        <label>
          Source:
          <select value={source} onChange={e => setSource(e.target.value as 'funding' | 'spot')}>
            <option value="funding">Pay from Funding</option>
            <option value="spot">Pay from Spot</option>
          </select>
        </label>
      </div>

      <div className="amount-input">
        <Field
          label="Amount"
          value={rawAmount}
          onChange={(e) => setRawAmount(e.target.value)}
          error={!parseResult.ok && rawAmount ? t(parseResult.error as string) : undefined}
        />
      </div>

      <div className="preview-section">
        {isLoading && <p>Loading preview...</p>}
        {errorMessage && <p className="error" role="alert">{errorMessage}</p>}
        {!isLoading && !errorMessage && !preview && <p>Enter amount to see preview</p>}
        
        {preview && (
          <div className="preview-details">
            <p>INDICATIVE PREVIEW</p>
            <p>Rate: {formatDisplay(preview.rate, { locale })}</p>
            <p>Fee: {formatDisplay(preview.fee, { locale })}</p>
            <p>Net Amount: {formatDisplay(preview.netAmount, { locale })}</p>
            <Button onClick={() => setIsModalOpen(true)} data-testid="convert-btn">
              {t('Convert')}
            </Button>
          </div>
        )}
      </div>

      {previewParams && preview && (
        <SwapConfirmModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          previewParams={previewParams}
          previewData={preview}
        />
      )}
    </div>
  );
}

