'use client';

import { useTranslation } from '@/shared/i18n';
import {
  useNotifications,
  useUnreadCount,
  useMarkAllRead,
  useMarkRead,
  useMarkUnread,
  useDeleteRead,
} from '../queries';
import type { AppNotification } from '../types';
import styles from './profile.module.css';

// Resolve unread count from either { count } shape or bare number
function resolveCount(data: { count: number } | number | undefined): number {
  if (data === undefined || data === null) return 0;
  if (typeof data === 'number') return data;
  return data.count ?? 0;
}

export function NotificationsView() {
  const { t, locale } = useTranslation();
  const { data, isLoading, isError } = useNotifications();
  const { data: unreadData } = useUnreadCount();
  const markAllRead = useMarkAllRead();
  const markRead = useMarkRead();
  const markUnread = useMarkUnread();
  const deleteRead = useDeleteRead();

  if (isLoading) return <p>{t('common.loading')}</p>;

  if (isError) {
    return (
      <p role="alert" className={styles.error}>
        {t('profile.notifications.error')}
      </p>
    );
  }

  const items: AppNotification[] = data?.notificaciones ?? [];
  const unreadCount = resolveCount(unreadData);

  return (
    <section className={styles.form}>
      {/* Header row: badge + bulk actions */}
      <div className={notifStyles.header}>
        <span className={notifStyles.badge}>
          {t('profile.notifications.unreadBadge', { count: unreadCount })}
        </span>
        <button
          type="button"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending}
        >
          {t('profile.notifications.markAllRead')}
        </button>
        <button
          type="button"
          onClick={() => deleteRead.mutate()}
          disabled={deleteRead.isPending}
        >
          {t('profile.notifications.deleteRead')}
        </button>
      </div>

      {items.length === 0 ? (
        <p>{t('profile.notifications.empty')}</p>
      ) : (
        <ul className={notifStyles.list}>
          {items.map((n) => {
            const isUnread = !n.read;
            const dateStr = new Date(
              n.created_at ?? n.sentAt ?? Date.now(),
            ).toLocaleDateString(locale);

            return (
              <li
                key={n.id}
                data-testid={`notification-${n.id}`}
                className={[notifStyles.item, isUnread ? notifStyles.unread : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className={notifStyles.itemHeader}>
                  <span className={notifStyles.typeLabel}>
                    {t(`profile.notifications.type.${n.type}`)}
                  </span>
                  <span className={notifStyles.date}>{dateStr}</span>
                </div>
                <p className={notifStyles.title}>{n.title}</p>
                <p className={notifStyles.message}>{n.message}</p>
                <div className={notifStyles.itemActions}>
                  {isUnread ? (
                    <button
                      type="button"
                      data-action="mark-read"
                      onClick={() => markRead.mutate(n.id)}
                      disabled={markRead.isPending}
                    >
                      {t('profile.notifications.markRead')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-action="mark-unread"
                      onClick={() => markUnread.mutate(n.id)}
                      disabled={markUnread.isPending}
                    >
                      {t('profile.notifications.markUnread')}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ── Inline style objects (no new CSS file needed — reuse profile.module.css
//    for error/form shell; notification-specific layout via inline styles) ──────

const notifStyles = {
  header: 'notifHeader',
  badge: 'notifBadge',
  list: 'notifList',
  item: 'notifItem',
  unread: 'notifItemUnread',
  itemHeader: 'notifItemHeader',
  typeLabel: 'notifTypeLabel',
  date: 'notifDate',
  title: 'notifTitle',
  message: 'notifMessage',
  itemActions: 'notifItemActions',
} as const;
