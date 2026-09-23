import React from 'react';
import { Dialog, Button } from '../../../shared/ui';
import { useTranslation, useErrorTranslation } from '../../../shared/i18n';
import { formatDisplay, CanonicalAmount } from '../../../shared/money';
import { isApiError } from '../../../shared/api';
import { useExecuteSwap } from '../queries';
import { CalculateSwapRequest, CalculateSwapResponse } from '../api';

interface SwapConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewParams: CalculateSwapRequest;
  previewData: CalculateSwapResponse;
}

export const SwapConfirmModal: React.FC<SwapConfirmModalProps> = ({
  isOpen,
  onClose,
  previewParams,
  previewData
}) => {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();
  
  const { mutate, isLoading, error, isSuccess, reset } = useExecuteSwap();

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  const handleConfirm = () => {
    mutate({
      from: previewParams.from,
      to: previewParams.to,
      amount: previewParams.amount,
      source: previewParams.source
    });
  };

  const modalContent = (
    <div>
      {isSuccess ? (
        <div data-testid="swap-success">
          <h3>{t('Swap successful')}</h3>
          <Button onClick={onClose} data-testid="close-btn">{t('Close')}</Button>
        </div>
      ) : (
        <>
          {error && (
            <div data-testid="swap-error" style={{ color: 'red', marginBottom: '1rem' }}>
              {isApiError(error) ? tError(error.code) : tError('FALLBACK_UNKNOWN_ERROR')}
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <p><strong>{t('INDICATIVE PREVIEW')}</strong> - {t('The final amount may differ.')}</p>
            <p>{t('Rate')}: {formatDisplay(previewData.rate, { locale })}</p>
            <p>{t('Fee')}: {formatDisplay(previewData.fee, { locale })}</p>
            <p>{t('Net to receive')}: {formatDisplay(previewData.netAmount, { locale })} {previewParams.to}</p>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <Button onClick={onClose} disabled={isLoading} data-testid="cancel-btn">
              {t('Cancel')}
            </Button>
            <Button onClick={handleConfirm} disabled={isLoading} data-testid="confirm-swap-btn">
              {isLoading ? t('Processing...') : t('Confirm')}
            </Button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={t('Confirm Swap')}>
      {modalContent}
    </Dialog>
  );
};
