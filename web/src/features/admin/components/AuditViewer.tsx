'use client';

// Load-more strategy: accumulate rows in component state.
// Clicking "Load more" sets beforeId = nextBeforeId from the last page,
// triggers a new useAudit({ beforeId }) call, and appends the new rows to a
// local accumulator (accRows). Changing the eventType filter resets both the
// accumulator and the cursor. This avoids re-fetching prior pages on every
// cursor advance.

import { useState, useRef } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useAudit, useAuditVerify } from '../queries';
import type { AuditQueryParams, AuditRow, AuditVerifyResult } from '../types';
import styles from './admin.module.css';

// ── AuditTable ────────────────────────────────────────────────────────────────

interface AuditTableProps {
  rows: AuditRow[];
  locale: string;
  t: (key: string) => string;
}

function AuditTable({ rows, locale, t }: AuditTableProps) {
  return (
    <table className={styles.configTable}>
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
            <td>{row.aggregateId ?? '—'}</td>
            <td>{new Date(row.occurredAt).toLocaleString(locale)}</td>
            <td className={styles.configValue}>{row.hash.slice(0, 12)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── VerifyStatus ──────────────────────────────────────────────────────────────

interface VerifyStatusProps {
  result: AuditVerifyResult | undefined;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function VerifyStatus({ result, t }: VerifyStatusProps) {
  if (!result) return null;
  if (result.ok) {
    return (
      <p className={styles.configSaved}>
        {t('admin.audit.verify.ok')}
      </p>
    );
  }
  return (
    <p role="alert" className={styles.fetchError}>
      {t('admin.audit.verify.broken', { seq: result.brokenAtSeq ?? 0 })}
    </p>
  );
}

// ── AuditViewer ───────────────────────────────────────────────────────────────

export function AuditViewer() {
  const { t, locale } = useTranslation();

  // Filter input (controlled)
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  // Applied filter (committed on change with debounce-free immediate apply)
  const [appliedFilter, setAppliedFilter] = useState('');

  // Pagination cursor for the current page being fetched
  const [beforeId, setBeforeId] = useState<number | undefined>(undefined);

  // Accumulated rows across all loaded pages for the current filter
  const [accRows, setAccRows] = useState<AuditRow[]>([]);

  // Track which page we already appended (keyed by beforeId) to prevent double-append
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
      // Replace on first page (initial or after filter reset), append otherwise
      if (beforeId === undefined) {
        setAccRows(data.rows);
      } else {
        setAccRows((prev) => {
          // deduplicate by id
          const seen = new Set(prev.map((r) => r.id));
          const fresh = data.rows.filter((r) => !seen.has(r.id));
          return [...prev, ...fresh];
        });
      }
    }
  }

  // Apply filter: reset cursor and accumulator
  function handleFilterApply(value: string) {
    setAppliedFilter(value);
    setBeforeId(undefined);
    setAccRows([]);
    appendedBeforeId.current = null;
  }

  function handleLoadMore() {
    if (data?.nextBeforeId != null) {
      setBeforeId(data.nextBeforeId);
    }
  }

  if (isLoading && accRows.length === 0) {
    return (
      <div className={styles.auditViewer}>
        <p className={styles.loadingState}>{t('common.loading')}</p>
      </div>
    );
  }

  if (isError && accRows.length === 0) {
    return (
      <div className={styles.auditViewer}>
        <p role="alert" className={styles.fetchError}>
          {t('common.error')}
        </p>
      </div>
    );
  }

  const nextBeforeId = data?.nextBeforeId ?? null;

  return (
    <div className={styles.auditViewer}>
      {/* Filter bar */}
      <div className={styles.configFilterBar}>
        <label htmlFor="audit-event-type-filter" className={styles.metaLabel}>
          {t('admin.audit.filterEventType.label')}
        </label>
        <input
          id="audit-event-type-filter"
          type="text"
          value={eventTypeFilter}
          onChange={(e) => {
            setEventTypeFilter(e.target.value);
            handleFilterApply(e.target.value);
          }}
          className={styles.configEditInput}
        />
      </div>

      {/* Verify chain button + result */}
      <div className={styles.actionButtons}>
        <button
          type="button"
          onClick={() => verifyMutation.mutate()}
          disabled={verifyMutation.isPending}
          className={styles.auditVerifyBtn}
        >
          {t('admin.audit.verify.cta')}
        </button>
      </div>

      <VerifyStatus
        result={verifyMutation.isSuccess ? (verifyMutation.data as AuditVerifyResult) : undefined}
        t={t}
      />

      {/* Audit table */}
      {accRows.length > 0 ? (
        <AuditTable rows={accRows} locale={locale} t={t} />
      ) : (
        !isLoading && <p className={styles.emptyState}>{t('admin.audit.col.eventType')}</p>
      )}

      {/* Load more */}
      {nextBeforeId !== null && (
        <div className={styles.actionButtons}>
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoading}
            className={styles.auditLoadMoreBtn}
          >
            {t('admin.audit.loadMore')}
          </button>
        </div>
      )}
    </div>
  );
}
