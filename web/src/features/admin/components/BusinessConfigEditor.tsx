'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button } from '@/shared/ui';
import { useConfig, useUpsertConfig } from '../queries';
import type { BusinessConfigItem } from '../types';
import styles from './admin.module.css';

// ── Valid types ───────────────────────────────────────────────────────────────

const VALID_TYPES = ['string', 'number', 'boolean', 'json'] as const;
type ConfigType = (typeof VALID_TYPES)[number];

// ── EditRow ───────────────────────────────────────────────────────────────────

interface EditRowProps {
  item: BusinessConfigItem;
  onCancel: () => void;
  upsertMutation: ReturnType<typeof useUpsertConfig>;
}

function EditRow({ item, onCancel, upsertMutation }: EditRowProps) {
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();

  const [editValue, setEditValue] = useState(item.value);
  const [editType, setEditType] = useState<ConfigType>(
    VALID_TYPES.includes(item.type as ConfigType) ? (item.type as ConfigType) : 'string',
  );
  const [editCategory, setEditCategory] = useState(item.category ?? '');
  const [editDescription, setEditDescription] = useState(item.description ?? '');

  const isValueValid = editValue.trim().length > 0;
  const isTypeValid = VALID_TYPES.includes(editType);
  const canSave = isValueValid && isTypeValid && !upsertMutation.isPending;

  function handleSave() {
    if (!canSave) return;
    upsertMutation.mutate(
      {
        key: item.key,
        body: {
          // value is ALWAYS sent as a string — never coerced to number
          value: editValue,
          type: editType,
          ...(editCategory.trim() ? { category: editCategory.trim() } : {}),
          ...(editDescription.trim() ? { description: editDescription.trim() } : {}),
        },
      },
      {
        onSuccess: () => {
          // Keep edit open so saved indicator is visible; parent will re-render
        },
      },
    );
  }

  return (
    <>
      <td className={styles.configValue}>
        <input
          id={`config-value-${item.key}`}
          type="text"
          className={styles.configEditInput}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          aria-label={t('admin.config.col.value')}
        />
      </td>
      <td>
        <select
          className={styles.configTypeSelect}
          value={editType}
          onChange={(e) => setEditType(e.target.value as ConfigType)}
          aria-label={t('admin.config.col.type')}
        >
          {VALID_TYPES.map((tp) => (
            <option key={tp} value={tp}>
              {tp}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input
          type="text"
          className={styles.configCategoryInput}
          value={editCategory}
          onChange={(e) => setEditCategory(e.target.value)}
          aria-label={t('admin.config.col.category')}
        />
      </td>
      <td>
        <input
          type="text"
          className={styles.configCategoryInput}
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          aria-label={t('admin.config.col.description')}
        />
      </td>
      <td>
        <div className={styles.configActions}>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            loading={upsertMutation.isPending}
          >
            {t('admin.config.save')}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={upsertMutation.isPending}>
            {t('common.cancel')}
          </Button>
        </div>
        {upsertMutation.isSuccess && (
          <p className={styles.configSaved}>{t('admin.config.saved')}</p>
        )}
        {upsertMutation.isError && upsertMutation.error != null && (
          <p role="alert" className={styles.configError}>
            {tError(
              (upsertMutation.error as { code?: string }).code ?? 'FALLBACK_UNKNOWN_ERROR',
              {
                requestId:
                  (upsertMutation.error as { requestId?: string }).requestId ?? '',
              },
            )}
          </p>
        )}
      </td>
    </>
  );
}

// ── ConfigRow ─────────────────────────────────────────────────────────────────

interface ConfigRowProps {
  item: BusinessConfigItem;
  upsertMutation: ReturnType<typeof useUpsertConfig>;
}

function ConfigRow({ item, upsertMutation }: ConfigRowProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <tr>
        <td>{item.key}</td>
        <EditRow
          item={item}
          onCancel={() => setEditing(false)}
          upsertMutation={upsertMutation}
        />
      </tr>
    );
  }

  return (
    <tr>
      <td>{item.key}</td>
      <td className={styles.configValue}>{item.value}</td>
      <td>{item.type ?? '—'}</td>
      <td>{item.category ?? '—'}</td>
      <td>{item.description ?? '—'}</td>
      <td>
        <Button onClick={() => setEditing(true)}>
          {t('common.edit')}
        </Button>
      </td>
    </tr>
  );
}

// ── BusinessConfigEditor ──────────────────────────────────────────────────────

export function BusinessConfigEditor() {
  const { t } = useTranslation();
  const [categoryFilter, setCategoryFilter] = useState('');

  // Pass undefined when empty so the hook lists all configs
  const category = categoryFilter.trim() || undefined;
  const { data, isLoading, isError } = useConfig(category);
  const upsertMutation = useUpsertConfig();

  if (isLoading) {
    return (
      <div className={styles.configEditor}>
        <p className={styles.loadingState}>{t('common.loading')}</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.configEditor}>
        <p role="alert" className={styles.fetchError}>
          {t('common.error')}
        </p>
      </div>
    );
  }

  const items = data?.data ?? [];

  return (
    <div className={styles.configEditor}>
      {/* Category filter */}
      <div className={styles.configFilterBar}>
        <label htmlFor="config-category-filter">
          {t('admin.config.categoryFilter.label')}
        </label>
        <input
          id="config-category-filter"
          type="text"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={styles.configCategoryInput}
        />
      </div>

      {/* Config table */}
      <table className={styles.configTable}>
        <thead>
          <tr>
            <th>{t('admin.config.col.key')}</th>
            <th>{t('admin.config.col.value')}</th>
            <th>{t('admin.config.col.type')}</th>
            <th>{t('admin.config.col.category')}</th>
            <th>{t('admin.config.col.description')}</th>
            <th>{/* actions */}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <ConfigRow key={item.key} item={item} upsertMutation={upsertMutation} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
