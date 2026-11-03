'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field, Input, Select, Dialog, Badge, EmptyState, ErrorState, Skeleton, useSuccessFlash } from '@/shared/ui';
import {
  useAmlConfig,
  useSetAmlConfig,
  useDenylist,
  useAddDenylist,
  useRemoveDenylist,
  useCases,
  useResolveCase,
} from '../queries';
import type { AmlCase } from '../types';
import styles from './admin.module.css';

// ── AML config keys (CONTRACT-LOCKED — do NOT change) ─────────────────────────
const AML_MONITORING_KEY = 'aml.monitoring.enabled';
const AML_HOLD_ENFORCEMENT_KEY = 'aml.holdEnforcement.enabled';

// ── ResolveDialog ─────────────────────────────────────────────────────────────

function ResolveDialog({
  amlCase,
  decision,
  onClose,
  resolveMutation,
}: {
  amlCase: AmlCase;
  decision: 'approve' | 'reject';
  onClose: () => void;
  resolveMutation: ReturnType<typeof useResolveCase>;
}) {
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const { flash } = useSuccessFlash();

  function handleConfirm() {
    resolveMutation.mutate(
      { id: amlCase.id, decision },
      {
        onSuccess: () => {
          flash({
            title: t('admin.aml.cases.flashTitle'),
            detail: decision === 'approve' ? t('admin.aml.cases.flashApprove') : t('admin.aml.cases.flashReject'),
          });
          onClose();
        },
      },
    );
  }

  const confirmLabel =
    decision === 'approve' ? t('admin.aml.cases.resolve.approve.cta') : t('admin.aml.cases.resolve.reject.cta');

  return (
    <Dialog isOpen onClose={onClose} title={confirmLabel} closeOnClickOutside={false}>
      <div className={styles.dialogBody}>
        <p className={styles.fourEyesNote}>{t('admin.aml.cases.resolveExplanation')}</p>

        {resolveMutation.isError && resolveMutation.error != null && (
          <p role="alert" className={styles.alert}>
            {tError(resolveMutation.error.code ?? 'FALLBACK_UNKNOWN_ERROR', { requestId: resolveMutation.error.requestId ?? '' })}
          </p>
        )}

        <div className={styles.dialogActions}>
          <Button onClick={handleConfirm} disabled={resolveMutation.isPending} loading={resolveMutation.isPending} variant={decision === 'reject' ? 'danger' : undefined}>
            {confirmLabel}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={resolveMutation.isPending}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ── CaseRow ────────────────────────────────────────────────────────────────────

function CaseRow({ amlCase, resolveMutation }: { amlCase: AmlCase; resolveMutation: ReturnType<typeof useResolveCase> }) {
  const { t } = useTranslation();
  const [resolveDialog, setResolveDialog] = useState<'approve' | 'reject' | null>(null);

  return (
    <div className={styles.actionRow}>
      <div className={styles.actionMeta}>
        <span className={styles.metaItem}>
          <span className={styles.metaLabel}>ID</span>
          <span className={`${styles.metaValue} ${styles.mono}`}>{amlCase.id}</span>
        </span>
        <span className={styles.metaItem}>
          <span className={styles.metaLabel}>{t('admin.aml.cases.status.label')}</span>
          <span><Badge tone={amlCase.status === 'open' ? 'warning' : 'neutral'}>{amlCase.status}</Badge></span>
        </span>
        {amlCase.signalId && (
          <span className={styles.metaItem}>
            <span className={styles.metaLabel}>{t('admin.aml.cases.signal.label')}</span>
            <span className={`${styles.metaValue} ${styles.mono}`}>{amlCase.signalId}</span>
          </span>
        )}
      </div>

      <div className={styles.actionButtons}>
        <Button onClick={() => setResolveDialog('approve')} disabled={resolveMutation.isPending}>
          {t('admin.aml.cases.resolve.approve.cta')}
        </Button>
        <Button variant="danger" onClick={() => setResolveDialog('reject')} disabled={resolveMutation.isPending}>
          {t('admin.aml.cases.resolve.reject.cta')}
        </Button>
      </div>

      {resolveDialog !== null && (
        <ResolveDialog amlCase={amlCase} decision={resolveDialog} onClose={() => setResolveDialog(null)} resolveMutation={resolveMutation} />
      )}
    </div>
  );
}

// ── AmlOps ─────────────────────────────────────────────────────────────────────

export function AmlOps() {
  const { t } = useTranslation();

  const amlConfig = useAmlConfig();
  const setAmlConfig = useSetAmlConfig();

  const denylist = useDenylist();
  const addDenylist = useAddDenylist();
  const removeDenylist = useRemoveDenylist();

  const [dlAddress, setDlAddress] = useState('');
  const [dlNetwork, setDlNetwork] = useState('');
  const [dlReason, setDlReason] = useState('');
  const [dlSource, setDlSource] = useState('');

  const [statusFilter, setStatusFilter] = useState('');
  const cases = useCases(statusFilter || undefined);
  const resolveCase = useResolveCase();

  function handleToggleMonitoring() {
    const current = amlConfig.data?.monitoringEnabled ?? false;
    setAmlConfig.mutate({ key: AML_MONITORING_KEY, value: !current ? 'true' : 'false' });
  }

  function handleToggleHoldEnforcement() {
    const current = amlConfig.data?.holdEnforcementEnabled ?? false;
    setAmlConfig.mutate({ key: AML_HOLD_ENFORCEMENT_KEY, value: !current ? 'true' : 'false' });
  }

  function handleAddDenylist() {
    const req: { address: string; network: string; reason?: string; source?: string } = {
      address: dlAddress,
      network: dlNetwork,
    };
    if (dlReason.trim()) req.reason = dlReason;
    if (dlSource.trim()) req.source = dlSource;

    addDenylist.mutate(req, {
      onSuccess: () => {
        setDlAddress('');
        setDlNetwork('');
        setDlReason('');
        setDlSource('');
      },
    });
  }

  const statusOptions = [
    { value: '', label: t('admin.aml.cases.filterAll') },
    { value: 'open', label: 'open' },
    { value: 'resolved', label: 'resolved' },
  ];

  return (
    <div className={styles.panel}>
      {/* ── Config Toggles ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('admin.aml.config.heading')}</h2>
        {amlConfig.isLoading && (
          <div role="status" aria-label={t('common.loading')} className={styles.skelRow}>
            <Skeleton variant="text" width="30%" />
          </div>
        )}
        {amlConfig.isError && <ErrorState title={t('common.error')} onRetry={() => amlConfig.refetch()} retryLabel={t('common.retry')} />}
        {amlConfig.data && (
          <div className={styles.toggleRow}>
            <div className={styles.toggleItem}>
              <Button onClick={handleToggleMonitoring} disabled={setAmlConfig.isPending} variant="secondary">
                {t('admin.aml.monitoring.toggle')}
              </Button>
              <Badge tone={amlConfig.data.monitoringEnabled ? 'success' : 'neutral'}>
                {amlConfig.data.monitoringEnabled ? 'ON' : 'OFF'}
              </Badge>
            </div>
            <div className={styles.toggleItem}>
              <Button onClick={handleToggleHoldEnforcement} disabled={setAmlConfig.isPending} variant="secondary">
                {t('admin.aml.holdEnforcement.toggle')}
              </Button>
              <Badge tone={amlConfig.data.holdEnforcementEnabled ? 'success' : 'neutral'}>
                {amlConfig.data.holdEnforcementEnabled ? 'ON' : 'OFF'}
              </Badge>
            </div>
          </div>
        )}
      </section>

      {/* ── Denylist ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('admin.aml.denylist.list.heading')}</h2>

        <div className={styles.filterBar}>
          <Field label={t('admin.aml.denylist.address.label')}>
            <Input id="denylist-address" type="text" value={dlAddress} onChange={(e) => setDlAddress(e.target.value)} autoComplete="off" />
          </Field>
          <Field label={t('admin.aml.denylist.network.label')}>
            <Input id="denylist-network" type="text" value={dlNetwork} onChange={(e) => setDlNetwork(e.target.value)} autoComplete="off" />
          </Field>
          <Field label={t('admin.aml.denylist.reason.label')}>
            <Input id="denylist-reason" type="text" value={dlReason} onChange={(e) => setDlReason(e.target.value)} autoComplete="off" />
          </Field>
          <Field label={t('admin.aml.denylist.source.label')}>
            <Input id="denylist-source" type="text" value={dlSource} onChange={(e) => setDlSource(e.target.value)} autoComplete="off" />
          </Field>
          <Button onClick={handleAddDenylist} disabled={addDenylist.isPending || dlAddress.trim() === '' || dlNetwork.trim() === ''} loading={addDenylist.isPending}>
            {t('admin.aml.denylist.add.cta')}
          </Button>
        </div>

        {denylist.isLoading && (
          <div role="status" aria-label={t('common.loading')} className={styles.skelRow}>
            <Skeleton variant="text" width="40%" />
          </div>
        )}
        {denylist.isError && <ErrorState title={t('common.error')} onRetry={() => denylist.refetch()} retryLabel={t('common.retry')} />}
        {denylist.data && denylist.data.length === 0 && <EmptyState title={t('admin.aml.denylist.empty')} />}
        {denylist.data && denylist.data.map((entry) => (
          <div key={entry.id} className={styles.actionRow}>
            <div className={styles.actionMeta}>
              <span className={styles.metaItem}>
                <span className={styles.metaLabel}>{t('admin.aml.denylist.address.label')}</span>
                <span className={`${styles.metaValue} ${styles.mono}`}>{entry.address}</span>
              </span>
              <span className={styles.metaItem}>
                <span className={styles.metaLabel}>{t('admin.aml.denylist.network.label')}</span>
                <span className={styles.metaValue}>{entry.network}</span>
              </span>
              {entry.reason && (
                <span className={styles.metaItem}>
                  <span className={styles.metaLabel}>{t('admin.aml.denylist.reason.label')}</span>
                  <span className={styles.metaValue}>{entry.reason}</span>
                </span>
              )}
            </div>
            <div className={styles.actionButtons}>
              <Button variant="danger" onClick={() => removeDenylist.mutate(entry.id)} disabled={removeDenylist.isPending}>
                {t('admin.aml.denylist.remove.cta')}
              </Button>
            </div>
          </div>
        ))}
      </section>

      {/* ── Cases ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('admin.aml.cases.list.heading')}</h2>

        <div className={styles.filterBar}>
          <div className={styles.filterField}>
            <span className={styles.fieldLabel} id="cases-status-filter-label">{t('admin.aml.cases.statusFilter.label')}</span>
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={setStatusFilter}
              aria-label={t('admin.aml.cases.statusFilter.label')}
              aria-labelledby="cases-status-filter-label"
            />
          </div>
        </div>

        {cases.isLoading && (
          <div role="status" aria-label={t('common.loading')} className={styles.skelRow}>
            <Skeleton variant="text" width="40%" />
          </div>
        )}
        {cases.isError && <ErrorState title={t('common.error')} onRetry={() => cases.refetch()} retryLabel={t('common.retry')} />}
        {cases.data && cases.data.length === 0 && <EmptyState title={t('admin.aml.cases.empty')} />}
        {cases.data && cases.data.map((amlCase) => (
          <CaseRow key={amlCase.id} amlCase={amlCase} resolveMutation={resolveCase} />
        ))}
      </section>
    </div>
  );
}
