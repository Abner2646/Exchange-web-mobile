'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Input, Dialog, Badge, Skeleton } from '@/shared/ui';
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
import styles from './admin.module.css';

// ── DeleteConfirmDialog ────────────────────────────────────────────────────────

function DeleteConfirmDialog({ user, onConfirm, onClose, isPending }: { user: AdminUser | null; onConfirm: () => void; onClose: () => void; isPending: boolean }) {
  const { t } = useTranslation();
  return (
    <Dialog isOpen={user !== null} onClose={onClose} title={t('admin.users.confirmDelete.title')} closeOnClickOutside={!isPending}>
      <p>{t('admin.users.confirmDelete.body')}</p>
      <div className={styles.dialogActions}>
        <Button variant="secondary" onClick={onClose} disabled={isPending}>{t('common.cancel')}</Button>
        <Button variant="danger" onClick={onConfirm} disabled={isPending} loading={isPending}>{t('common.confirm')}</Button>
      </div>
    </Dialog>
  );
}

// ── UserRow ────────────────────────────────────────────────────────────────────

function UserRow({ user, isSuperAdmin, totalCols, onDeleteClick }: { user: AdminUser; isSuperAdmin: boolean; totalCols: number; onDeleteClick: (user: AdminUser) => void }) {
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();

  const [dailyLimitInput, setDailyLimitInput] = useState(user.dailyLimitUsd ?? user.dailyLimit ?? '');
  const [reputationInput, setReputationInput] = useState(user.averageRating !== undefined ? String(user.averageRating) : '');

  const statusMutation = useUpdateUserStatus();
  const kycMutation = useUpdateUserKyc();
  const dailyLimitMutation = useUpdateUserDailyLimit();
  const reputationMutation = useUpdateUserReputation();
  const roleMutation = useUpdateUserRole();

  const activeError: (ApiError & { requestId?: string }) | null =
    (statusMutation.isError && statusMutation.error) ||
    (kycMutation.isError && kycMutation.error) ||
    (dailyLimitMutation.isError && dailyLimitMutation.error) ||
    (reputationMutation.isError && reputationMutation.error) ||
    (roleMutation.isError && roleMutation.error) ||
    null;

  const anyPending =
    statusMutation.isPending || kycMutation.isPending || dailyLimitMutation.isPending || reputationMutation.isPending || roleMutation.isPending;

  return (
    <>
      <tr>
        <td className={styles.mono}>{user.username}</td>
        <td>{user.email}</td>
        <td>
          <span className={styles.cellActions}>
            <Badge tone={user.role === 'super_admin' ? 'brand' : user.role === 'admin' ? 'warning' : 'neutral'}>{user.role}</Badge>
            {isSuperAdmin && (
              <Button
                size="small"
                variant="secondary"
                aria-label={t('admin.users.roleChange.label')}
                disabled={anyPending}
                loading={roleMutation.isPending}
                onClick={() => roleMutation.mutate({ id: user.id, body: { role: user.role === 'admin' ? 'user' : 'admin' } })}
              >
                {t('admin.users.roleChange.label')}
              </Button>
            )}
          </span>
        </td>
        <td>
          <span className={styles.cellActions}>
            <Badge tone={user.active ? 'success' : 'neutral'}>{user.active ? t('admin.users.yes') : t('admin.users.no')}</Badge>
            <Button
              size="small"
              variant="secondary"
              aria-label={t('admin.users.statusToggle.label')}
              disabled={statusMutation.isPending}
              loading={statusMutation.isPending}
              onClick={() => statusMutation.mutate({ id: user.id, body: { active: !user.active } })}
            >
              {t('admin.users.statusToggle.label')}
            </Button>
          </span>
        </td>
        <td>
          <span className={styles.cellActions}>
            <Badge tone={user.kycVerified ? 'success' : 'neutral'}>{user.kycVerified ? t('admin.users.yes') : t('admin.users.no')}</Badge>
            <Button
              size="small"
              variant="secondary"
              aria-label={t('admin.users.kycUpdate.label')}
              disabled={kycMutation.isPending}
              loading={kycMutation.isPending}
              onClick={() => kycMutation.mutate({ id: user.id, body: { verified: !user.kycVerified } })}
            >
              {t('admin.users.kycUpdate.label')}
            </Button>
          </span>
        </td>
        <td>
          <span className={styles.cellActions}>
            <Input type="text" className={styles.inlineInput} value={dailyLimitInput} aria-label={t('admin.users.dailyLimit.label')} onChange={(e) => setDailyLimitInput(e.target.value)} />
            <Button size="small" variant="secondary" disabled={dailyLimitMutation.isPending || !dailyLimitInput} loading={dailyLimitMutation.isPending} onClick={() => dailyLimitMutation.mutate({ id: user.id, body: { dailyLimitUsd: dailyLimitInput } })}>
              {t('admin.config.save')}
            </Button>
          </span>
        </td>
        <td>
          <span className={styles.cellActions}>
            <Input type="text" className={styles.inlineInputNarrow} value={reputationInput} aria-label={t('admin.users.reputation.label')} onChange={(e) => setReputationInput(e.target.value)} />
            <Button
              size="small"
              variant="secondary"
              disabled={reputationMutation.isPending || !reputationInput}
              loading={reputationMutation.isPending}
              onClick={() => {
                const avg = Number(reputationInput);
                if (!Number.isNaN(avg)) reputationMutation.mutate({ id: user.id, body: { averageRating: avg } });
              }}
            >
              {t('admin.config.save')}
            </Button>
          </span>
        </td>
        {isSuperAdmin && (
          <td>
            <Button size="small" variant="danger" aria-label={t('admin.users.delete.label')} onClick={() => onDeleteClick(user)}>
              {t('admin.users.delete.label')}
            </Button>
          </td>
        )}
      </tr>
      {activeError && (
        <tr>
          <td colSpan={totalCols}>
            <span role="alert" className={styles.alert}>
              {tError(activeError.code ?? 'FALLBACK_UNKNOWN_ERROR', { requestId: activeError.requestId ?? '' })}
            </span>
          </td>
        </tr>
      )}
    </>
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

  const totalCols = 7 + (isSuperAdmin ? 1 : 0);

  const filteredUsers = searchQ.trim()
    ? users.filter((u) => u.username.toLowerCase().includes(searchQ.toLowerCase()) || u.email.toLowerCase().includes(searchQ.toLowerCase()))
    : users;

  function handleDeleteConfirm() {
    if (!pendingDelete) return;
    deleteMutation.mutate(
      { id: pendingDelete.id },
      { onSuccess: () => setPendingDelete(null), onError: () => setPendingDelete(null) },
    );
  }

  return (
    <section className={styles.section}>
      {stats && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('admin.users.stats.heading')}</h2>
          <div className={styles.statGrid}>
            {Object.entries(stats).map(([k, v]) => (
              <div key={k} className={styles.statChip}>
                <span className={styles.statLabel}>{k}</span>
                <span className={styles.statValue}>{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.filterBar}>
        <Input type="search" className={styles.inlineInput} style={{ width: '16rem' }} placeholder={t('admin.users.search.placeholder')} value={searchQ} onChange={(e) => setSearchQ(e.target.value)} aria-label={t('admin.users.search.placeholder')} />
      </div>

      {isLoading ? (
        <div role="status" aria-label={t('common.loading')} className={styles.skelRow}>
          <Skeleton variant="text" width="60%" />
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('admin.users.col.username')}</th>
                <th>{t('admin.users.col.email')}</th>
                <th>{t('admin.users.col.role')}</th>
                <th>{t('admin.users.col.active')}</th>
                <th>{t('admin.users.col.kyc')}</th>
                <th>{t('admin.users.dailyLimit.label')}</th>
                <th>{t('admin.users.reputation.label')}</th>
                {isSuperAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <UserRow key={user.id} user={user} isSuperAdmin={isSuperAdmin} totalCols={totalCols} onDeleteClick={setPendingDelete} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isSuperAdmin && (
        <DeleteConfirmDialog user={pendingDelete} onConfirm={handleDeleteConfirm} onClose={() => setPendingDelete(null)} isPending={deleteMutation.isPending} />
      )}
    </section>
  );
}
