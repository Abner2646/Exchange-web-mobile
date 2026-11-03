'use client';

import { useTranslation } from '@/shared/i18n';
import { Badge, Button, EmptyState, ErrorState, Skeleton } from '@/shared/ui';
import {
  useNotifications,
  useUnreadCount,
  useMarkAllRead,
  useMarkRead,
  useMarkUnread,
  useDeleteRead,
} from '../queries';
import type { AppNotification, NotificationType } from '../types';
import styles from './profile.module.css';

function resolveCount(data: { count: number } | number | undefined): number {
  if (data === undefined || data === null) return 0;
  if (typeof data === 'number') return data;
  return data.count ?? 0;
}

const TYPE_TONE: Record<NotificationType, 'brand' | 'success' | 'warning' | 'neutral'> = {
  security: 'brand',
  transaction: 'success',
  kyc: 'warning',
  system: 'neutral',
  p2p: 'neutral',
  exchange: 'neutral',
};

export function NotificationsView() {
  const { t, locale } = useTranslation();
  const { data, isLoading, isError } = useNotifications();
  const { data: unreadData } = useUnreadCount();
  const markAllRead = useMarkAllRead();
  const markRead = useMarkRead();
  const markUnread = useMarkUnread();
  const deleteRead = useDeleteRead();

  if (isLoading) {
    return (
      <div className={styles.card} role="status" aria-label={t('common.loading')}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.skelRow}>
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="text" width={80} />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.card}>
        <ErrorState title={t('profile.notifications.error')} />
      </div>
    );
  }

  const items: AppNotification[] = data?.notificaciones ?? [];
  const unreadCount = resolveCount(unreadData);

  return (
    <section className={styles.card}>
      <div className={styles.notifHeader}>
        <Badge tone={unreadCount > 0 ? 'brand' : 'neutral'}>
          {t('profile.notifications.unreadBadge', { count: unreadCount })}
        </Badge>
        <span className={styles.spacer} />
        <Button size="small" variant="secondary" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
          {t('profile.notifications.markAllRead')}
        </Button>
        <Button size="small" variant="secondary" onClick={() => deleteRead.mutate()} disabled={deleteRead.isPending}>
          {t('profile.notifications.deleteRead')}
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState title={t('profile.notifications.empty')} />
      ) : (
        <ul className={styles.notifList}>
          {items.map((n) => {
            const isUnread = !n.read;
            const dateStr = new Date(n.created_at ?? n.sentAt ?? Date.now()).toLocaleDateString(locale);

            return (
              <li
                key={n.id}
                data-testid={`notification-${n.id}`}
                className={isUnread ? styles.notifItemUnread : styles.notifItem}
              >
                <div className={styles.notifItemHeader}>
                  <Badge tone={TYPE_TONE[n.type] ?? 'neutral'}>{t(`profile.notifications.type.${n.type}`)}</Badge>
                  <span className={styles.notifDate}>{dateStr}</span>
                </div>
                <p className={styles.notifTitle}>{n.title}</p>
                <p className={styles.notifMessage}>{n.message}</p>
                <div className={styles.notifItemActions}>
                  {isUnread ? (
                    <Button size="small" variant="secondary" data-action="mark-read" onClick={() => markRead.mutate(n.id)} disabled={markRead.isPending}>
                      {t('profile.notifications.markRead')}
                    </Button>
                  ) : (
                    <Button size="small" variant="secondary" data-action="mark-unread" onClick={() => markUnread.mutate(n.id)} disabled={markUnread.isPending}>
                      {t('profile.notifications.markUnread')}
                    </Button>
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
