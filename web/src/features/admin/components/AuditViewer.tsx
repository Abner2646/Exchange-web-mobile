'use client';

// Load-more strategy: accumulate rows in component state. Clicking "Load more"
// sets beforeId = nextBeforeId from the last page, triggers a new useAudit({ beforeId })
// call, and appends the new rows to a local accumulator (accRows). Changing the
// eventType filter resets both the accumulator and the cursor.

import { useState, useRef } from 'react';
import { useTranslation } from '@/shared/i18n';
import { Button, Field, Input, EmptyState, ErrorState, Skeleton } from '@/shared/ui';
import { useAudit, useAuditVerify } from '../queries';
import type { AuditQueryParams, AuditRow, AuditVerifyResult } from '../types';
import styles from './admin.module.css';

function AuditTable({ rows, locale, t }: { rows: AuditRow[]; locale: string; t: (key: string) => string }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('admin.audit.col.eventType')}</th>
            <th>{t('admin.audit.col.aggregate')}</th>
            <th>{t('admin.audit.col.occurred')}</th>
            <th>{t('admin.audit.col.hash')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.eventType}</td>
              <td className={styles.mono}>{row.aggregateId ?? '—'}</td>
              <td>{new Date(row.occurredAt).toLocaleString(locale)}</td>
              <td className={styles.mono}>{row.hash.slice(0, 12)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VerifyStatus({ result, t }: { result: AuditVerifyResult | undefined; t: (key: string, params?: Record<string, string | number>) => string }) {
  if (!result) return null;
  if (result.ok) return <p className={styles.success}>{t('admin.audit.verify.ok')}</p>;
  return <p role="alert" className={styles.alert}>{t('admin.audit.verify.broken', { seq: result.brokenAtSeq ?? 0 })}</p>;
}

export function AuditViewer() {
  const { t, locale } = useTranslation();

  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [appliedFilter, setAppliedFilter] = useState('');
  const [beforeId, setBeforeId] = useState<number | undefined>(undefined);
  const [accRows, setAccRows] = useState<AuditRow[]>([]);
  const appendedBeforeId = useRef<number | 'initial' | null>(null);

  const params: AuditQueryParams = {
    ...(appliedFilter ? { eventType: appliedFilter } : {}),
    ...(beforeId !== undefined ? { beforeId } : {}),
  };

  const { data, isLoading, isError } = useAudit(params);
  const verifyMutation = useAuditVerify();

  // Sync fetched rows into accumulator (only when a new page lands)
  if (!isLoading && !isError && data) {
    const pageKey = beforeId ?? 'initial';
    if (appendedBeforeId.current !== pageKey) {
      appendedBeforeId.current = pageKey;
      if (beforeId === undefined) {
        setAccRows(data.rows);
      } else {
        setAccRows((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          const fresh = data.rows.filter((r) => !seen.has(r.id));
          return [...prev, ...fresh];
        });
      }
    }
  }

  function handleFilterApply(value: string) {
    setAppliedFilter(value);
    setBeforeId(undefined);
    setAccRows([]);
    appendedBeforeId.current = null;
  }

  function handleLoadMore() {
    if (data?.nextBeforeId != null) setBeforeId(data.nextBeforeId);
  }

  if (isLoading && accRows.length === 0) {
    return (
      <div role="status" aria-label={t('common.loading')} className={styles.skelRow}>
        <Skeleton variant="text" width="60%" />
      </div>
    );
  }

  if (isError && accRows.length === 0) {
    return <ErrorState title={t('common.error')} />;
  }

  const nextBeforeId = data?.nextBeforeId ?? null;

  return (
    <div className={styles.section}>
      <div className={styles.filterBar}>
        <Field label={t('admin.audit.filterEventType.label')}>
          <Input
            id="audit-event-type-filter"
            type="text"
            value={eventTypeFilter}
            onChange={(e) => {
              setEventTypeFilter(e.target.value);
              handleFilterApply(e.target.value);
            }}
            autoComplete="off"
          />
        </Field>
        <Button variant="secondary" onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending} loading={verifyMutation.isPending}>
          {t('admin.audit.verify.cta')}
        </Button>
      </div>

      <VerifyStatus result={verifyMutation.isSuccess ? (verifyMutation.data as AuditVerifyResult) : undefined} t={t} />

      {accRows.length > 0 ? (
        <AuditTable rows={accRows} locale={locale} t={t} />
      ) : (
        !isLoading && <EmptyState title={t('admin.audit.empty')} />
      )}

      {nextBeforeId !== null && (
        <div className={styles.actionButtons}>
          <Button variant="secondary" onClick={handleLoadMore} disabled={isLoading}>
            {t('admin.audit.loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
