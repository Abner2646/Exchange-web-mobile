'use client';

import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button } from '@/shared/ui';
import { useKycStatus, useRequestKyc } from '../queries';
import styles from './profile.module.css';

export function KycStatusCard() {
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();

  const { data, isLoading, isError: isQueryError } = useKycStatus();
  const mutation = useRequestKyc();

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return <p>{t('common.loading')}</p>;
  }

  // ── Query error ───────────────────────────────────────────────────────────
  if (isQueryError || data == null) {
    return (
      <p role="alert" className={styles.error}>
        {t('common.loading')}
      </p>
    );
  }

  const { kycVerified, kycLevel } = data;

  return (
    <div className={styles.form}>
      {/* Status indicator */}
      <p>
        {kycVerified
          ? t('profile.kyc.status.verified')
          : t('profile.kyc.status.unverified')}
      </p>

      {/* Level */}
      <p>
        <span>{t('profile.kyc.level.label')}: </span>
        <span>{kycLevel}</span>
      </p>

      {/* Unverified branch */}
      {!kycVerified && (
        <>
          {/* Mutation error */}
          {mutation.isError && mutation.error != null && (
            <p role="alert" className={styles.error}>
              {tError(mutation.error.code, { requestId: mutation.error.requestId ?? '' })}
            </p>
          )}

          {/* Success: submitted/pending state */}
          {mutation.isSuccess ? (
            <p role="status" className={styles.success}>
              {t('profile.kyc.submittedNote')}
            </p>
          ) : (
            <>
              {/* External provider note */}
              <p className={styles.warning}>
                {t('profile.kyc.externalProviderNote')}
              </p>

              {/* CTA */}
              <div className={styles.actions}>
                <Button
                  disabled={mutation.isPending}
                  loading={mutation.isPending}
                  onClick={() => mutation.mutate()}
                >
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
