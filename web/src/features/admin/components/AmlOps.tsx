'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field, Dialog } from '@/shared/ui';
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

interface ResolveDialogProps {
  amlCase: AmlCase;
  decision: 'approve' | 'reject';
  onClose: () => void;
  resolveMutation: ReturnType<typeof useResolveCase>;
}

function ResolveDialog({ amlCase, decision, onClose, resolveMutation }: ResolveDialogProps) {
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();

  function handleClose() {
    onClose();
  }

  function handleConfirm() {
    resolveMutation.mutate(
      { id: amlCase.id, decision },
      { onSuccess: onClose },
    );
  }

  const confirmLabel =
    decision === 'approve'
      ? t('admin.aml.cases.resolve.approve.cta')
      : t('admin.aml.cases.resolve.reject.cta');

  return (
    <Dialog
      isOpen
      onClose={handleClose}
      title={confirmLabel}
      closeOnClickOutside={false}
    >
      <div className={styles.dialogBody}>
        <p className={styles.fourEyesNote}>
          {t('admin.aml.cases.resolveExplanation')}
        </p>

        {resolveMutation.isError && resolveMutation.error != null && (
          <p role="alert" className={styles.dialogError}>
            {tError(
              (resolveMutation.error as { code?: string }).code ?? 'FALLBACK_UNKNOWN_ERROR',
              {
                requestId:
                  (resolveMutation.error as { requestId?: string }).requestId ?? '',
              },
            )}
          </p>
        )}

        <div className={styles.dialogActions}>
          <Button
            onClick={handleConfirm}
            disabled={resolveMutation.isPending}
            loading={resolveMutation.isPending}
            variant={decision === 'reject' ? 'danger' : undefined}
          >
            {confirmLabel}
          </Button>
          <Button variant="secondary" onClick={handleClose} disabled={resolveMutation.isPending}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ── CaseRow ────────────────────────────────────────────────────────────────────

interface CaseRowProps {
  amlCase: AmlCase;
  resolveMutation: ReturnType<typeof useResolveCase>;
}

function CaseRow({ amlCase, resolveMutation }: CaseRowProps) {
  const { t } = useTranslation();
  const [resolveDialog, setResolveDialog] = useState<'approve' | 'reject' | null>(null);

  return (
    <div className={styles.actionRow}>
      <div className={styles.actionMeta}>
        <span>
          <span className={styles.metaLabel}>ID:</span>
          {amlCase.id}
        </span>
        <span>
          <span className={styles.metaLabel}>Status:</span>
          {amlCase.status}
        </span>
        {amlCase.signalId && (
          <span>
            <span className={styles.metaLabel}>Signal:</span>
            {amlCase.signalId}
          </span>
        )}
      </div>

      <div className={styles.actionButtons}>
        <Button
          onClick={() => setResolveDialog('approve')}
          disabled={resolveMutation.isPending}
        >
          {t('admin.aml.cases.resolve.approve.cta')}
        </Button>
        <Button
          variant="danger"
          onClick={() => setResolveDialog('reject')}
          disabled={resolveMutation.isPending}
        >
          {t('admin.aml.cases.resolve.reject.cta')}
        </Button>
      </div>

      {resolveDialog !== null && (
        <ResolveDialog
          amlCase={amlCase}
          decision={resolveDialog}
          onClose={() => setResolveDialog(null)}
          resolveMutation={resolveMutation}
        />
      )}
    </div>
  );
}

// ── AmlOps ─────────────────────────────────────────────────────────────────────

export function AmlOps() {
  const { t } = useTranslation();

  // ── Config section ───────────────────────────────────────────────────────────
  const amlConfig = useAmlConfig();
  const setAmlConfig = useSetAmlConfig();

  // ── Denylist section ─────────────────────────────────────────────────────────
  const denylist = useDenylist();
  const addDenylist = useAddDenylist();
  const removeDenylist = useRemoveDenylist();

  const [dlAddress, setDlAddress] = useState('');
  const [dlNetwork, setDlNetwork] = useState('');
  const [dlReason, setDlReason] = useState('');
  const [dlSource, setDlSource] = useState('');

  // ── Cases section ────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState('');
  const cases = useCases(statusFilter || undefined);
  const resolveCase = useResolveCase();

  // ── Helpers ──────────────────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.configEditor}>

      {/* ── Config Toggles ── */}
      <section>
        {amlConfig.isLoading && (
          <p className={styles.loadingState}>{t('common.loading')}</p>
        )}
        {amlConfig.isError && (
          <p role="alert" className={styles.fetchError}>{t('common.error')}</p>
        )}
        {amlConfig.data && (
          <div className={styles.configActions}>
            <Button
              onClick={handleToggleMonitoring}
              disabled={setAmlConfig.isPending}
            >
              {t('admin.aml.monitoring.toggle')}
            </Button>
            <span className={styles.configValue}>
              {amlConfig.data.monitoringEnabled ? 'ON' : 'OFF'}
            </span>

            <Button
              onClick={handleToggleHoldEnforcement}
              disabled={setAmlConfig.isPending}
            >
              {t('admin.aml.holdEnforcement.toggle')}
            </Button>
            <span className={styles.configValue}>
              {amlConfig.data.holdEnforcementEnabled ? 'ON' : 'OFF'}
            </span>
          </div>
        )}
      </section>

      {/* ── Denylist ── */}
      <section>
        <h3>{t('admin.aml.denylist.list.heading')}</h3>

        {/* Add form */}
        <div className={styles.configFilterBar}>
          <Field label={t('admin.aml.denylist.address.label')}>
            <input
              id="denylist-address"
              type="text"
              value={dlAddress}
              onChange={(e) => setDlAddress(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label={t('admin.aml.denylist.network.label')}>
            <input
              id="denylist-network"
              type="text"
              value={dlNetwork}
              onChange={(e) => setDlNetwork(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label={t('admin.aml.denylist.reason.label')}>
            <input
              id="denylist-reason"
              type="text"
              value={dlReason}
              onChange={(e) => setDlReason(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label={t('admin.aml.denylist.source.label')}>
            <input
              id="denylist-source"
              type="text"
              value={dlSource}
              onChange={(e) => setDlSource(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Button
            onClick={handleAddDenylist}
            disabled={addDenylist.isPending || dlAddress.trim() === '' || dlNetwork.trim() === ''}
            loading={addDenylist.isPending}
          >
            {t('admin.aml.denylist.add.cta')}
          </Button>
        </div>

        {/* List */}
        {denylist.isLoading && (
          <p className={styles.loadingState}>{t('common.loading')}</p>
        )}
        {denylist.isError && (
          <p role="alert" className={styles.fetchError}>{t('common.error')}</p>
        )}
        {denylist.data && denylist.data.length === 0 && (
          <p className={styles.emptyState}>{t('admin.aml.denylist.list.heading')}</p>
        )}
        {denylist.data && denylist.data.map((entry) => (
          <div key={entry.id} className={styles.actionRow}>
            <div className={styles.actionMeta}>
              <span>
                <span className={styles.metaLabel}>{t('admin.aml.denylist.address.label')}:</span>
                {entry.address}
              </span>
              <span>
                <span className={styles.metaLabel}>{t('admin.aml.denylist.network.label')}:</span>
                {entry.network}
              </span>
              {entry.reason && (
                <span>
                  <span className={styles.metaLabel}>{t('admin.aml.denylist.reason.label')}:</span>
                  {entry.reason}
                </span>
              )}
            </div>
            <div className={styles.actionButtons}>
              <Button
                variant="danger"
                onClick={() => removeDenylist.mutate(entry.id)}
                disabled={removeDenylist.isPending}
              >
                {t('admin.aml.denylist.remove.cta')}
              </Button>
            </div>
          </div>
        ))}
      </section>

      {/* ── Cases ── */}
      <section>
        <h3>{t('admin.aml.cases.list.heading')}</h3>

        <div className={styles.configFilterBar}>
          <Field label={t('admin.aml.cases.statusFilter.label')}>
            <select
              id="cases-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="open">open</option>
              <option value="resolved">resolved</option>
            </select>
          </Field>
        </div>

        {cases.isLoading && (
          <p className={styles.loadingState}>{t('common.loading')}</p>
        )}
        {cases.isError && (
          <p role="alert" className={styles.fetchError}>{t('common.error')}</p>
        )}
        {cases.data && cases.data.length === 0 && (
          <p className={styles.emptyState}>{t('admin.aml.cases.list.heading')}</p>
        )}
        {cases.data && cases.data.map((amlCase) => (
          <CaseRow
            key={amlCase.id}
            amlCase={amlCase}
            resolveMutation={resolveCase}
          />
        ))}
      </section>

    </div>
  );
}
