'use client';

import { useTranslation } from '@/shared/i18n';
import { useReadiness } from '../queries';
import type { OperatorSummary } from '../types';
import styles from './admin.module.css';

// ── OperatorList ──────────────────────────────────────────────────────────────

interface OperatorListProps {
  operators: OperatorSummary[];
  badge: string;
}

function OperatorList({ operators, badge }: OperatorListProps) {
  return (
    <ul className={styles.operatorList}>
      {operators.map((op) => (
        <li key={op.id} className={styles.operatorItem}>
          <span className={styles.operatorEmail}>{op.email}</span>
          <span className={styles.operatorRole}>{op.role}</span>
          <span className={styles.operatorBadge}>{badge}</span>
        </li>
      ))}
    </ul>
  );
}

// ── OperatorReadinessCard ─────────────────────────────────────────────────────

export function OperatorReadinessCard() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useReadiness();

  if (isLoading) {
    return (
      <div className={styles.readinessCard}>
        <p className={styles.loadingState}>{t('common.loading')}</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={styles.readinessCard}>
        <p role="alert" className={styles.fetchError}>
          {t('common.error')}
        </p>
      </div>
    );
  }

  const { ready, operatorCount, enrolledCount, minEnrolled, enrolled, pending, reasons } = data;

  return (
    <div className={styles.readinessCard}>
      {/* Badge */}
      <div className={styles.readinessBadgeRow}>
        <span
          className={ready ? styles.readinessBadgeReady : styles.readinessBadgeNotReady}
        >
          {ready ? t('admin.readiness.ready') : t('admin.readiness.notReady')}
        </span>
      </div>

      {/* Counts */}
      <dl className={styles.readinessCounts}>
        <div className={styles.readinessCountItem}>
          <dt className={styles.metaLabel}>{t('admin.readiness.operatorCount.label')}</dt>
          <dd>{operatorCount}</dd>
        </div>
        <div className={styles.readinessCountItem}>
          <dt className={styles.metaLabel}>{t('admin.readiness.enrolledCount.label')}</dt>
          <dd>{enrolledCount}</dd>
        </div>
        <div className={styles.readinessCountItem}>
          <dt className={styles.metaLabel}>{t('admin.readiness.minEnrolled.label')}</dt>
          <dd>{minEnrolled}</dd>
        </div>
      </dl>

      {/* Reasons (only when not ready) */}
      {!ready && reasons.length > 0 && (
        <div className={styles.readinessReasons}>
          <h3 className={styles.readinessSectionHeading}>
            {t('admin.readiness.reasons.heading')}
          </h3>
          <ul className={styles.readinessReasonList}>
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Enrolled operators */}
      {enrolled.length > 0 && (
        <div className={styles.readinessSection}>
          <h3 className={styles.readinessSectionHeading}>
            {t('admin.readiness.enrolled.heading')}
          </h3>
          <OperatorList operators={enrolled} badge="enrolled" />
        </div>
      )}

      {/* Pending enrollment */}
      {pending.length > 0 && (
        <div className={styles.readinessSection}>
          <h3 className={styles.readinessSectionHeading}>
            {t('admin.readiness.pending.heading')}
          </h3>
          <OperatorList operators={pending} badge="pending" />
        </div>
      )}
    </div>
  );
}
