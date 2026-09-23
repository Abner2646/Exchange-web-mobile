import React, { useState } from 'react';
import { usePendingActions, useApproveAction, useRejectAction } from '../queries';
import { formatDisplay } from '../../../shared/money';
import { Button, Dialog, Field } from '../../../shared/ui';
import { useTranslation } from '../../../shared/i18n';

function getFriendlyErrorMessage(code: string, t: (k: string) => string): string {
  switch (code) {
    case 'MAKER_CHECKER_SAME_USER':
      return 'You cannot approve your own proposal.';
    case 'MAKER_CHECKER_INVALID_STATE':
      return 'This action is no longer pending.';
    case 'MAKER_CHECKER_EXPIRED':
      return 'This proposal has expired.';
    case 'MFA_INVALID':
      return 'Invalid 2FA code.';
    case 'NOT_FOUND':
      return 'Action not found.';
    default:
      return t(code);
  }
}

export const MakerCheckerInbox: React.FC = () => {
  const { data, isLoading, error } = usePendingActions();
  const approveMutation = useApproveAction();
  const rejectMutation = useRejectAction();
  const { t, locale } = useTranslation();

  const [approveDialogId, setApproveDialogId] = useState<string | null>(null);
  const [rejectDialogId, setRejectDialogId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [reason, setReason] = useState('');

  const handleApproveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!approveDialogId || !codigo) return;
    approveMutation.mutate(
      { id: approveDialogId, codigo },
      {
        onSuccess: () => {
          setApproveDialogId(null);
          setCodigo('');
        },
      }
    );
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectDialogId) return;
    rejectMutation.mutate(
      { id: rejectDialogId, reason },
      {
        onSuccess: () => {
          setRejectDialogId(null);
          setReason('');
        },
      }
    );
  };

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error loading actions</p>;

  const pending = data?.pending || [];

  return (
    <>
      <h2>Maker-Checker Inbox</h2>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Amount (USD)</th>
            <th>Maker</th>
            <th>Created</th>
            <th>Expiry</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {pending.map((action) => (
            <tr key={action.id}>
              <td>{action.actionType}</td>
              <td>{action.amountUsd ? formatDisplay(action.amountUsd, { locale }) : 'N/A'}</td>
              <td>{action.makerUserId}</td>
              <td>{new Date(action.created_at).toLocaleString()}</td>
              <td>{new Date(action.expires_at).toLocaleString()}</td>
              <td>
                <Button 
                  onClick={() => setApproveDialogId(action.id)}
                  disabled={approveMutation.isLoading || rejectMutation.isLoading}
                >
                  Approve
                </Button>
                <Button 
                  onClick={() => setRejectDialogId(action.id)}
                  disabled={approveMutation.isLoading || rejectMutation.isLoading}
                >
                  Reject
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {approveMutation.error && (
        <div style={{ color: 'red' }} role="alert">
          {getFriendlyErrorMessage((approveMutation.error as any)?.response?.data?.error?.code || 'ERROR', t)}
        </div>
      )}
      {rejectMutation.error && (
        <div style={{ color: 'red' }} role="alert">
          {getFriendlyErrorMessage((rejectMutation.error as any)?.response?.data?.error?.code || 'ERROR', t)}
        </div>
      )}

      <Dialog
        isOpen={approveDialogId !== null}
        onClose={() => { setApproveDialogId(null); setCodigo(''); }}
        title="Approve Action"
      >
        <form onSubmit={handleApproveSubmit}>
          <p>Please enter your 2FA code to approve this action. You cannot approve your own proposal.</p>
          <Field
            label="2FA Code"
            id="codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            disabled={approveMutation.isLoading}
          />
          <Button type="submit" disabled={approveMutation.isLoading || !codigo}>
            {approveMutation.isLoading ? 'Approving...' : 'Confirm Approve'}
          </Button>
        </form>
      </Dialog>

      <Dialog
        isOpen={rejectDialogId !== null}
        onClose={() => { setRejectDialogId(null); setReason(''); }}
        title="Reject Action"
      >
        <form onSubmit={handleRejectSubmit}>
          <Field
            label="Reason (optional)"
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={rejectMutation.isLoading}
          />
          <Button type="submit" disabled={rejectMutation.isLoading}>
            {rejectMutation.isLoading ? 'Rejecting...' : 'Confirm Reject'}
          </Button>
        </form>
      </Dialog>
    </>
  );
};
