'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field, Input, Select, EmptyState, ErrorState, Skeleton } from '@/shared/ui';
import { useConfig, useUpsertConfig } from '../queries';
import type { BusinessConfigItem } from '../types';
import styles from './admin.module.css';

const VALID_TYPES = ['string', 'number', 'boolean', 'json'] as const;
type ConfigType = (typeof VALID_TYPES)[number];

// ── EditRow ───────────────────────────────────────────────────────────────────

function EditRow({ item, onCancel, upsertMutation }: { item: BusinessConfigItem; onCancel: () => void; upsertMutation: ReturnType<typeof useUpsertConfig> }) {
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();

  const [editValue, setEditValue] = useState(item.value);
  const [editType, setEditType] = useState<ConfigType>(
    VALID_TYPES.includes(item.type as ConfigType) ? (item.type as ConfigType) : 'string',
  );
  const [editCategory, setEditCategory] = useState(item.category ?? '');
  const [editDescription, setEditDescription] = useState(item.description ?? '');

  const isValueValid = editValue.trim().length > 0;
  const canSave = isValueValid && VALID_TYPES.includes(editType) && !upsertMutation.isPending;

  function handleSave() {
    if (!canSave) return;
    upsertMutation.mutate({
      key: item.key,
      body: {
        // value is ALWAYS sent as a string — never coerced to number
        value: editValue,
        type: editType,
        ...(editCategory.trim() ? { category: editCategory.trim() } : {}),
        ...(editDescription.trim() ? { description: editDescription.trim() } : {}),
      },
    });
  }

  return (
    <>
      <td>
        <Input id={`config-value-${item.key}`} type="text" className={styles.mono} value={editValue} onChange={(e) => setEditValue(e.target.value)} aria-label={t('admin.config.col.value')} />
      </td>
      <td>
        <Select
          options={VALID_TYPES.map((tp) => ({ value: tp, label: tp }))}
          value={editType}
          onChange={(v) => setEditType(v as ConfigType)}
          aria-label={t('admin.config.col.type')}
        />
      </td>
      <td>
        <Input type="text" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} aria-label={t('admin.config.col.category')} />
      </td>
      <td>
        <Input type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} aria-label={t('admin.config.col.description')} />
      </td>
      <td>
        <div className={styles.cellActions}>
          <Button size="small" onClick={handleSave} disabled={!canSave} loading={upsertMutation.isPending}>
            {t('admin.config.save')}
          </Button>
          <Button size="small" variant="secondary" onClick={onCancel} disabled={upsertMutation.isPending}>
            {t('common.cancel')}
          </Button>
        </div>
        {upsertMutation.isSuccess && <p className={styles.success}>{t('admin.config.saved')}</p>}
        {upsertMutation.isError && upsertMutation.error != null && (
          <p role="alert" className={styles.alert}>
            {tError(upsertMutation.error.code ?? 'FALLBACK_UNKNOWN_ERROR', { requestId: upsertMutation.error.requestId ?? '' })}
          </p>
        )}
      </td>
    </>
  );
}

// ── ConfigRow ─────────────────────────────────────────────────────────────────

function ConfigRow({ item, upsertMutation }: { item: BusinessConfigItem; upsertMutation: ReturnType<typeof useUpsertConfig> }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <tr>
        <td className={styles.mono}>{item.key}</td>
        <EditRow item={item} onCancel={() => setEditing(false)} upsertMutation={upsertMutation} />
      </tr>
    );
  }

  return (
    <tr>
      <td className={styles.mono}>{item.key}</td>
      <td className={styles.mono}>{item.value}</td>
      <td>{item.type ?? '—'}</td>
      <td>{item.category ?? '—'}</td>
      <td>{item.description ?? '—'}</td>
      <td>
        <Button size="small" variant="secondary" onClick={() => setEditing(true)}>{t('common.edit')}</Button>
      </td>
    </tr>
  );
}

// ── BusinessConfigEditor ──────────────────────────────────────────────────────

export function BusinessConfigEditor() {
  const { t } = useTranslation();
  const [categoryFilter, setCategoryFilter] = useState('');

  const category = categoryFilter.trim() || undefined;
  const { data, isLoading, isError, refetch } = useConfig(category);
  const upsertMutation = useUpsertConfig();

  if (isLoading) {
    return (
      <div role="status" aria-label={t('common.loading')} className={styles.skelRow}>
        <Skeleton variant="text" width="60%" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState title={t('common.error')} onRetry={() => refetch()} retryLabel={t('common.retry')} />;
  }

  const items = data?.data ?? [];

  return (
    <div className={styles.section}>
      <div className={styles.filterBar}>
        <Field label={t('admin.config.categoryFilter.label')}>
          <Input id="config-category-filter" type="text" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} autoComplete="off" />
        </Field>
      </div>

      {items.length === 0 ? (
        <EmptyState title={t('admin.config.empty')} />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('admin.config.col.key')}</th>
                <th>{t('admin.config.col.value')}</th>
                <th>{t('admin.config.col.type')}</th>
                <th>{t('admin.config.col.category')}</th>
                <th>{t('admin.config.col.description')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <ConfigRow key={item.key} item={item} upsertMutation={upsertMutation} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
