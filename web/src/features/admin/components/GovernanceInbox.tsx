'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field, Dialog } from '@/shared/ui';
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
          setCodigo('');
          onClose();
        },
      },
    );
  }

  return (
    <Dialog
      isOpen
      onClose={handleClose}
      title={t('admin.governance.approve.cta')}
      closeOnClickOutside={false}
    >
      <div className={styles.dialogBody}>
        <p className={styles.fourEyesNote}>
          {t('admin.governance.fourEyesNote')}
        </p>

        <Field label={t('admin.governance.totp.label')} helpText={t('admin.governance.totp.hint')}>
          <input
            id="governance-approve-codigo"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
        </Field>

        {approveMutation.isError && approveMutation.error != null && (
          <p role="alert" className={styles.dialogError}>
            {tError(
              (approveMutation.error as { code?: string }).code ?? 'FALLBACK_UNKNOWN_ERROR',
              {
                requestId:
                  (approveMutation.error as { requestId?: string }).requestId ?? '',
              },
            )}
          </p>
        )}

        <div className={styles.dialogActions}>
          <Button
            onClick={handleConfirm}
            disabled={approveMutation.isPending || codigo.length === 0}
            loading={approveMutation.isPending}
          >
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
          setReason('');
          onClose();
        },
      },
    );
  }

  return (
    <Dialog
      isOpen
      onClose={handleClose}
      title={t('admin.governance.reject.cta')}
      closeOnClickOutside={false}
    >
      <div className={styles.dialogBody}>
        <Field label={t('admin.governance.reject.reason.label')}>
          <input
            id="governance-reject-reason"
            type="text"
            autoComplete="off"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>

        {rejectMutation.isError && rejectMutation.error != null && (
          <p role="alert" className={styles.dialogError}>
            {tError(
              (rejectMutation.error as { code?: string }).code ?? 'FALLBACK_UNKNOWN_ERROR',
              {
                requestId:
                  (rejectMutation.error as { requestId?: string }).requestId ?? '',
              },
            )}
          </p>
        )}

        <div className={styles.dialogActions}>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={rejectMutation.isPending}
            loading={rejectMutation.isPending}
          >
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

interface ActionRowProps {
  action: PendingAction;
  approveMutation: ReturnType<typeof useApproveAction>;
  rejectMutation: ReturnType<typeof useRejectAction>;
}

function ActionRow({ action, approveMutation, rejectMutation }: ActionRowProps) {
  const { t, locale } = useTranslation();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const anyPending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className={styles.actionRow}>
      <div className={styles.actionMeta}>
        <span>
          <span className={styles.metaLabel}>{t('admin.governance.actionType.label')}:</span>
          {action.actionType}
        </span>
        <span>
          <span className={styles.metaLabel}>{t('admin.governance.amountUsd.label')}:</span>
          {/* amountUsd is rendered VERBATIM — never coerced through parseFloat/Number/toFixed */}
          {action.amountUsd !== null ? action.amountUsd : '—'}
        </span>
        <span>
          <span className={styles.metaLabel}>{t('admin.governance.maker.label')}:</span>
          {action.makerUserId}
        </span>
        <span>
          <span className={styles.metaLabel}>{t('admin.governance.created.label')}:</span>
          {new Date(action.created_at).toLocaleString(locale)}
        </span>
        <span>
          <span className={styles.metaLabel}>{t('admin.governance.expires.label')}:</span>
          {new Date(action.expiresAt).toLocaleString(locale)}
        </span>
      </div>

      <div className={styles.actionButtons}>
        <Button
          onClick={() => setApproveOpen(true)}
          disabled={anyPending}
        >
          {t('admin.governance.approve.cta')}
        </Button>
        <Button
          variant="danger"
          onClick={() => setRejectOpen(true)}
          disabled={anyPending}
        >
          {t('admin.governance.reject.cta')}
        </Button>
      </div>

      {approveOpen && (
        <ApproveDialog
          action={action}
          onClose={() => setApproveOpen(false)}
          approveMutation={approveMutation}
        />
      )}
      {rejectOpen && (
        <RejectDialog
          action={action}
          onClose={() => setRejectOpen(false)}
          rejectMutation={rejectMutation}
        />
      )}
    </div>
  );
}

// ── GovernanceInbox ───────────────────────────────────────────────────────────

export function GovernanceInbox() {
  const { t } = useTranslation();
  const { data, isLoading, isError, error } = usePending();
  const approveMutation = useApproveAction();
  const rejectMutation = useRejectAction();

  if (isLoading) {
    return (
      <div className={styles.inbox}>
        <p className={styles.loadingState}>{t('common.loading')}</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.inbox}>
        <p role="alert" className={styles.fetchError}>
          {t('common.error')}
        </p>
      </div>
    );
  }

  const pending = data?.pending ?? [];

  if (pending.length === 0) {
    return (
      <div className={styles.inbox}>
        <p className={styles.emptyState}>{t('admin.governance.pending.empty')}</p>
      </div>
    );
  }

  return (
    <div className={styles.inbox}>
      {pending.map((action) => (
        <ActionRow
          key={action.id}
          action={action}
          approveMutation={approveMutation}
          rejectMutation={rejectMutation}
        />
      ))}
    </div>
  );
}
