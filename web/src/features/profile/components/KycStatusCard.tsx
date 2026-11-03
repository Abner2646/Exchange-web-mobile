'use client';

import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Badge, Button, ErrorState, Skeleton } from '@/shared/ui';
import { useKycStatus, useRequestKyc } from '../queries';
import styles from './profile.module.css';

export function KycStatusCard() {
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();

  const { data, isLoading, isError: isQueryError } = useKycStatus();
  const mutation = useRequestKyc();

  if (isLoading) {
    return (
      <div className={styles.card} role="status" aria-label={t('common.loading')}>
        <Skeleton variant="text" width={120} height={22} />
        <Skeleton variant="text" width="60%" />
      </div>
    );
  }

  if (isQueryError || data == null) {
    return (
      <div className={styles.card}>
        <ErrorState title={t('common.error')} />
      </div>
    );
  }

  const { kycVerified, kycLevel } = data;

  return (
    <div className={styles.card}>
      <div className={styles.statusRow}>
        <span className={styles.statusLabel}>{t('profile.kyc.status.label')}</span>
        <Badge tone={kycVerified ? 'success' : 'neutral'}>
          {kycVerified ? t('profile.kyc.status.verified') : t('profile.kyc.status.unverified')}
        </Badge>
      </div>

      <div className={styles.statusRow}>
        <span className={styles.statusLabel}>{t('profile.kyc.level.label')}</span>
        <Badge tone="brand">{kycLevel}</Badge>
      </div>

      {!kycVerified && (
        <>
          {mutation.isError && mutation.error != null && (
            <p role="alert" className={styles.alert}>
              {tError(mutation.error.code, { requestId: mutation.error.requestId ?? '' })}
            </p>
          )}

          {mutation.isSuccess ? (
            <p role="status" className={styles.success}>{t('profile.kyc.submittedNote')}</p>
          ) : (
            <>
              <p className={styles.warning}>{t('profile.kyc.externalProviderNote')}</p>
              <div className={styles.actions}>
                <Button disabled={mutation.isPending} loading={mutation.isPending} onClick={() => mutation.mutate()}>
                  {t('profile.kyc.startCta')}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
