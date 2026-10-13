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
      <div className={styles.notifHeader}>
        <span className={styles.notifBadge}>
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
        <ul className={styles.notifList}>
          {items.map((n) => {
            const isUnread = !n.read;
            const dateStr = new Date(
              n.created_at ?? n.sentAt ?? Date.now(),
            ).toLocaleDateString(locale);

            return (
              <li
                key={n.id}
                data-testid={`notification-${n.id}`}
                className={[styles.notifItem, isUnread ? styles.notifItemUnread : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className={styles.notifItemHeader}>
                  <span className={styles.notifTypeLabel}>
                    {t(`profile.notifications.type.${n.type}`)}
                  </span>
                  <span className={styles.notifDate}>{dateStr}</span>
                </div>
                <p className={styles.notifTitle}>{n.title}</p>
                <p className={styles.notifMessage}>{n.message}</p>
                <div className={styles.notifItemActions}>
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
