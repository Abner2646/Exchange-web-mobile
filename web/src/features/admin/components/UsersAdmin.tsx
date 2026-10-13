'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Dialog } from '@/shared/ui';
import { useCurrentUser } from '@/features/auth/queries';
import { isSuperAdminRole } from '../roles';
import type { ApiError } from '@/shared/api';
import {
  useUsers,
  useUpdateUserStatus,
  useUpdateUserKyc,
  useUpdateUserDailyLimit,
  useUpdateUserReputation,
  useUpdateUserRole,
  useDeleteUser,
  useUserStats,
} from '../queries';
import type { AdminUser } from '../types';

// ── DeleteConfirmDialog ────────────────────────────────────────────────────────

interface DeleteConfirmDialogProps {
  user: AdminUser | null;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}

function DeleteConfirmDialog({ user, onConfirm, onClose, isPending }: DeleteConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog
      isOpen={user !== null}
      onClose={onClose}
      title={t('admin.users.confirmDelete.title')}
      closeOnClickOutside={!isPending}
    >
      <p>{t('admin.users.confirmDelete.body')}</p>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onClose} disabled={isPending}>
          {t('common.cancel') || 'Cancel'}
        </Button>
        <Button
          variant="danger"
          onClick={onConfirm}
          disabled={isPending}
          loading={isPending}
        >
          {t('common.confirm') || 'Confirm'}
        </Button>
      </div>
    </Dialog>
  );
}

// ── UserRow ────────────────────────────────────────────────────────────────────

interface UserRowProps {
  user: AdminUser;
  isSuperAdmin: boolean;
  onDeleteClick: (user: AdminUser) => void;
}

function UserRow({ user, isSuperAdmin, onDeleteClick }: UserRowProps) {
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();

  const [dailyLimitInput, setDailyLimitInput] = useState(user.dailyLimitUsd ?? user.dailyLimit ?? '');
  const [reputationInput, setReputationInput] = useState(
    user.averageRating !== undefined ? String(user.averageRating) : '',
  );

  const statusMutation = useUpdateUserStatus();
  const kycMutation = useUpdateUserKyc();
  const dailyLimitMutation = useUpdateUserDailyLimit();
  const reputationMutation = useUpdateUserReputation();
  const roleMutation = useUpdateUserRole();

  // Collect any active error from mutations on this row
  const activeError: (ApiError & { requestId?: string }) | null =
    (statusMutation.isError && statusMutation.error) ||
    (kycMutation.isError && kycMutation.error) ||
    (dailyLimitMutation.isError && dailyLimitMutation.error) ||
    (reputationMutation.isError && reputationMutation.error) ||
    (roleMutation.isError && roleMutation.error) ||
    null;

  const anyPending =
    statusMutation.isPending ||
    kycMutation.isPending ||
    dailyLimitMutation.isPending ||
    reputationMutation.isPending ||
    roleMutation.isPending;

  return (
    <tr>
      <td>{user.username}</td>
      <td>{user.email}</td>
      <td>
        {isSuperAdmin ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>{user.role}</span>
            <Button
              size="small"
              variant="secondary"
              aria-label={t('admin.users.roleChange.label')}
              disabled={anyPending || roleMutation.isPending}
              loading={roleMutation.isPending}
              onClick={() => {
                const newRole = user.role === 'admin' ? 'user' : 'admin';
                roleMutation.mutate({ id: user.id, body: { role: newRole } });
              }}
            >
              {t('admin.users.roleChange.label')}
            </Button>
          </div>
        ) : (
          <span>{user.role}</span>
        )}
      </td>
      <td>
        <Button
          size="small"
          variant={user.active ? 'secondary' : 'primary'}
          aria-label={t('admin.users.statusToggle.label')}
          disabled={statusMutation.isPending}
          loading={statusMutation.isPending}
          onClick={() =>
            statusMutation.mutate({ id: user.id, body: { active: !user.active } })
          }
        >
          {t('admin.users.statusToggle.label')}
        </Button>
      </td>
      <td>
        <Button
          size="small"
          variant="secondary"
          aria-label={t('admin.users.kycUpdate.label')}
          disabled={kycMutation.isPending}
          loading={kycMutation.isPending}
          onClick={() =>
            kycMutation.mutate({ id: user.id, body: { verified: !user.kycVerified } })
          }
        >
          {t('admin.users.kycUpdate.label')}
        </Button>
        <span style={{ marginLeft: '0.25rem' }}>{user.kycVerified ? 'yes' : 'no'}</span>
      </td>
      <td>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <input
            type="text"
            value={dailyLimitInput}
            aria-label={t('admin.users.dailyLimit.label')}
            onChange={(e) => setDailyLimitInput(e.target.value)}
            style={{ width: '6rem' }}
          />
          <Button
            size="small"
            variant="secondary"
            disabled={dailyLimitMutation.isPending || !dailyLimitInput}
            loading={dailyLimitMutation.isPending}
            onClick={() =>
              dailyLimitMutation.mutate({
                id: user.id,
                body: { dailyLimitUsd: dailyLimitInput },
              })
            }
          >
            {t('admin.config.save') || 'Save'}
          </Button>
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <input
            type="text"
            value={reputationInput}
            aria-label={t('admin.users.reputation.label')}
            onChange={(e) => setReputationInput(e.target.value)}
            style={{ width: '4rem' }}
          />
          <Button
            size="small"
            variant="secondary"
            disabled={reputationMutation.isPending || !reputationInput}
            loading={reputationMutation.isPending}
            onClick={() => {
              const avg = Number(reputationInput);
              if (!Number.isNaN(avg)) {
                reputationMutation.mutate({
                  id: user.id,
                  body: { averageRating: avg },
                });
              }
            }}
          >
            {t('admin.config.save') || 'Save'}
          </Button>
        </div>
      </td>
      {isSuperAdmin && (
        <td>
          <Button
            size="small"
            variant="danger"
            aria-label={t('admin.users.delete.label')}
            onClick={() => onDeleteClick(user)}
          >
            {t('admin.users.delete.label')}
          </Button>
        </td>
      )}
      {activeError && (
        <td colSpan={isSuperAdmin ? 1 : 0}>
          <span role="alert" style={{ color: 'red', fontSize: '0.75rem' }}>
            {tError(
              (activeError as { code?: string }).code ?? 'FALLBACK_UNKNOWN_ERROR',
              { requestId: (activeError as { requestId?: string }).requestId ?? '' },
            )}
          </span>
        </td>
      )}
    </tr>
  );
}

// ── UsersAdmin ─────────────────────────────────────────────────────────────────

export function UsersAdmin() {
  const { t } = useTranslation();
  const { data: currentUser } = useCurrentUser();
  const isSuperAdmin = isSuperAdminRole(currentUser);

  const { data: users = [], isLoading } = useUsers();
  const { data: stats } = useUserStats();
  const deleteMutation = useDeleteUser();

  const [searchQ, setSearchQ] = useState('');
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);

  const filteredUsers = searchQ.trim()
    ? users.filter(
        (u) =>
          u.username.toLowerCase().includes(searchQ.toLowerCase()) ||
          u.email.toLowerCase().includes(searchQ.toLowerCase()),
      )
    : users;

  function handleDeleteConfirm() {
    if (!pendingDelete) return;
    deleteMutation.mutate(
      { id: pendingDelete.id },
      {
        onSuccess: () => setPendingDelete(null),
        onError: () => setPendingDelete(null),
      },
    );
  }

  return (
    <section>
      {/* Stats panel */}
      {stats && (
        <div>
          <h3>{t('admin.users.stats.heading')}</h3>
          <ul>
            {Object.entries(stats).map(([k, v]) => (
              <li key={k}>
                {k}: {String(v)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: '1rem' }}>
        <input
          type="search"
          placeholder={t('admin.users.search.placeholder')}
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          aria-label={t('admin.users.search.placeholder')}
        />
      </div>

      {/* User table */}
      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t('admin.users.col.username')}</th>
              <th>{t('admin.users.col.email')}</th>
              <th>{t('admin.users.col.role')}</th>
              <th>{t('admin.users.col.active')}</th>
              <th>{t('admin.users.col.kyc')}</th>
              <th>{t('admin.users.dailyLimit.label')}</th>
              <th>{t('admin.users.reputation.label')}</th>
              {isSuperAdmin && <th>{/* actions */}</th>}
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                isSuperAdmin={isSuperAdmin}
                onDeleteClick={setPendingDelete}
              />
            ))}
          </tbody>
        </table>
      )}

      {/* Delete confirm dialog — super-admin only */}
      {isSuperAdmin && (
        <DeleteConfirmDialog
          user={pendingDelete}
          onConfirm={handleDeleteConfirm}
          onClose={() => setPendingDelete(null)}
          isPending={deleteMutation.isPending}
        />
      )}
    </section>
  );
}
