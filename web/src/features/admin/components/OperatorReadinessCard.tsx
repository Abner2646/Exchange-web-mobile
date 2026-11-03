'use client';

import { useTranslation } from '@/shared/i18n';
import { Badge, ErrorState, Skeleton } from '@/shared/ui';
import { useReadiness } from '../queries';
import type { OperatorSummary } from '../types';
import styles from './admin.module.css';

function OperatorList({ operators, badge, tone }: { operators: OperatorSummary[]; badge: string; tone: 'success' | 'warning' }) {
  return (
    <ul className={styles.operatorList}>
      {operators.map((op) => (
        <li key={op.id} className={styles.operatorItem}>
          <span className={styles.operatorEmail}>{op.email}</span>
          <span className={styles.operatorRole}>{op.role}</span>
          <Badge tone={tone}>{badge}</Badge>
        </li>
      ))}
    </ul>
  );
}

export function OperatorReadinessCard() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useReadiness();

  if (isLoading) {
    return (
      <div className={styles.card}>
        <div role="status" aria-label={t('common.loading')} className={styles.skelRow}>
          <Skeleton variant="text" width={90} height={24} />
          <Skeleton variant="text" width="50%" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={styles.card}>
        <ErrorState title={t('common.error')} />
      </div>
    );
  }

  const { ready, operatorCount, enrolledCount, minEnrolled, enrolled, pending, reasons } = data;

  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>{t('admin.readiness.heading')}</h2>

      <div>
        <Badge tone={ready ? 'success' : 'error'}>
          {ready ? t('admin.readiness.ready') : t('admin.readiness.notReady')}
        </Badge>
      </div>

      <dl className={styles.readinessCounts}>
        <div className={styles.countItem}>
          <dt className={styles.countLabel}>{t('admin.readiness.operatorCount.label')}</dt>
          <dd className={styles.countValue}>{operatorCount}</dd>
        </div>
        <div className={styles.countItem}>
          <dt className={styles.countLabel}>{t('admin.readiness.enrolledCount.label')}</dt>
          <dd className={styles.countValue}>{enrolledCount}</dd>
        </div>
        <div className={styles.countItem}>
          <dt className={styles.countLabel}>{t('admin.readiness.minEnrolled.label')}</dt>
          <dd className={styles.countValue}>{minEnrolled}</dd>
        </div>
      </dl>

      {!ready && reasons.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('admin.readiness.reasons.heading')}</h3>
          <ul className={styles.reasonList}>
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {enrolled.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('admin.readiness.enrolled.heading')}</h3>
          <OperatorList operators={enrolled} badge={t('admin.readiness.enrolledBadge')} tone="success" />
        </div>
      )}

      {pending.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('admin.readiness.pending.heading')}</h3>
          <OperatorList operators={pending} badge={t('admin.readiness.pendingBadge')} tone="warning" />
        </div>
      )}
    </div>
  );
}
