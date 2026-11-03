'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field, Input, Dialog, Badge, EmptyState, ErrorState, Skeleton, useSuccessFlash } from '@/shared/ui';
import { usePending, useApproveAction, useRejectAction } from '../queries';
import type { PendingAction } from '../types';
import styles from './admin.module.css';

// ── ApproveDialog ─────────────────────────────────────────────────────────────

interface ApproveDialogProps {
  action: PendingAction;
  onClose: () => void;
  approveMutation: ReturnType<typeof useApproveAction>;
}

function ApproveDialog({ action, onClose, approveMutation }: ApproveDialogProps) {
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const { flash } = useSuccessFlash();
  const [codigo, setCodigo] = useState('');

  function handleClose() {
    setCodigo('');
    onClose();
  }

  function handleConfirm() {
    approveMutation.mutate(
      { id: action.id, codigo },
      {
        onSuccess: () => {
          flash({ title: t('admin.governance.approve.flashTitle'), detail: t('admin.governance.approve.flashDetail') });
          setCodigo('');
          onClose();
        },
      },
    );
  }

  return (
    <Dialog isOpen onClose={handleClose} title={t('admin.governance.approve.cta')} closeOnClickOutside={false}>
      <div className={styles.dialogBody}>
        <p className={styles.fourEyesNote}>{t('admin.governance.fourEyesNote')}</p>

        <Field label={t('admin.governance.totp.label')} helpText={t('admin.governance.totp.hint')}>
          <Input id="governance-approve-codigo" type="text" inputMode="numeric" autoComplete="off" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        </Field>

        {approveMutation.isError && approveMutation.error != null && (
          <p role="alert" className={styles.alert}>
            {tError(approveMutation.error.code ?? 'FALLBACK_UNKNOWN_ERROR', { requestId: approveMutation.error.requestId ?? '' })}
          </p>
        )}

        <div className={styles.dialogActions}>
          <Button onClick={handleConfirm} disabled={approveMutation.isPending || codigo.length === 0} loading={approveMutation.isPending}>
            {t('admin.governance.approve.cta')}
          </Button>
          <Button variant="secondary" onClick={handleClose} disabled={approveMutation.isPending}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ── RejectDialog ──────────────────────────────────────────────────────────────

interface RejectDialogProps {
  action: PendingAction;
  onClose: () => void;
  rejectMutation: ReturnType<typeof useRejectAction>;
}

function RejectDialog({ action, onClose, rejectMutation }: RejectDialogProps) {
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const { flash } = useSuccessFlash();
  const [reason, setReason] = useState('');

  function handleClose() {
    setReason('');
    onClose();
  }

  function handleConfirm() {
    rejectMutation.mutate(
      { id: action.id, reason },
      {
        onSuccess: () => {
          flash({ title: t('admin.governance.reject.flashTitle'), detail: t('admin.governance.reject.flashDetail') });
          setReason('');
          onClose();
        },
      },
    );
  }

  return (
    <Dialog isOpen onClose={handleClose} title={t('admin.governance.reject.cta')} closeOnClickOutside={false}>
      <div className={styles.dialogBody}>
        <Field label={t('admin.governance.reject.reason.label')}>
          <Input id="governance-reject-reason" type="text" autoComplete="off" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>

        {rejectMutation.isError && rejectMutation.error != null && (
          <p role="alert" className={styles.alert}>
            {tError(rejectMutation.error.code ?? 'FALLBACK_UNKNOWN_ERROR', { requestId: rejectMutation.error.requestId ?? '' })}
          </p>
        )}

        <div className={styles.dialogActions}>
          <Button variant="danger" onClick={handleConfirm} disabled={rejectMutation.isPending} loading={rejectMutation.isPending}>
            {t('admin.governance.reject.cta')}
          </Button>
          <Button variant="secondary" onClick={handleClose} disabled={rejectMutation.isPending}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ── ActionRow ─────────────────────────────────────────────────────────────────

function Meta({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <span className={styles.metaItem}>
      <span className={styles.metaLabel}>{label}</span>
      <span className={`${styles.metaValue}${mono ? ` ${styles.mono}` : ''}`}>{value}</span>
    </span>
  );
}

function ActionRow({
  action,
  approveMutation,
  rejectMutation,
}: {
  action: PendingAction;
  approveMutation: ReturnType<typeof useApproveAction>;
  rejectMutation: ReturnType<typeof useRejectAction>;
}) {
  const { t, locale } = useTranslation();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const anyPending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className={styles.actionRow}>
      <div className={styles.actionMeta}>
        <Meta label={t('admin.governance.actionType.label')} value={action.actionType} />
        {/* amountUsd is rendered VERBATIM — never coerced through parseFloat/Number/toFixed */}
        <Meta label={t('admin.governance.amountUsd.label')} value={action.amountUsd !== null ? action.amountUsd : '—'} mono />
        <Meta label={t('admin.governance.maker.label')} value={action.makerUserId} mono />
        <Meta label={t('admin.governance.created.label')} value={new Date(action.created_at).toLocaleString(locale)} />
        <Meta label={t('admin.governance.expires.label')} value={new Date(action.expiresAt).toLocaleString(locale)} />
      </div>

      <div className={styles.actionButtons}>
        <Button onClick={() => setApproveOpen(true)} disabled={anyPending}>{t('admin.governance.approve.cta')}</Button>
        <Button variant="danger" onClick={() => setRejectOpen(true)} disabled={anyPending}>{t('admin.governance.reject.cta')}</Button>
      </div>

      {approveOpen && <ApproveDialog action={action} onClose={() => setApproveOpen(false)} approveMutation={approveMutation} />}
      {rejectOpen && <RejectDialog action={action} onClose={() => setRejectOpen(false)} rejectMutation={rejectMutation} />}
    </div>
  );
}

// ── GovernanceInbox ───────────────────────────────────────────────────────────

export function GovernanceInbox() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = usePending();
  const approveMutation = useApproveAction();
  const rejectMutation = useRejectAction();

  if (isLoading) {
    return (
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('admin.governance.heading')}</h2>
        <div role="status" aria-label={t('common.loading')}>
          {[0, 1].map((i) => (
            <div key={i} className={styles.skelRow}>
              <Skeleton variant="text" width="40%" />
              <Skeleton variant="text" width={90} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('admin.governance.heading')}</h2>
        <ErrorState title={t('common.error')} onRetry={() => refetch()} retryLabel={t('common.retry')} />
      </div>
    );
  }

  const pending = data?.pending ?? [];

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{t('admin.governance.heading')}</h2>
      {pending.length === 0 ? (
        <EmptyState title={t('admin.governance.pending.empty')} />
      ) : (
        <div className={styles.inbox}>
          {pending.map((action) => (
            <ActionRow key={action.id} action={action} approveMutation={approveMutation} rejectMutation={rejectMutation} />
          ))}
        </div>
      )}
    </div>
  );
}
