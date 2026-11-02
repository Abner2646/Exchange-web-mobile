'use client';

import { useMemo } from 'react';
import { formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { Badge, Button, EmptyState, ErrorState, Skeleton, ChartIcon } from '@/shared/ui';
import type { BadgeTone } from '@/shared/ui';
import { useActiveOrders, useCancelOrder, usePairs } from '../queries';
import type { OrderStatus, TradingOrder } from '../types';
import styles from './trading.module.css';

const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  pending: 'warning',
  open: 'brand',
  partially_filled: 'warning',
  filled: 'success',
  cancelled: 'neutral',
  expired: 'neutral',
  rejected: 'error',
};

export default function MyOrdersView() {
  const { t, locale } = useTranslation();
  const { data: orders, isLoading, isError, refetch } = useActiveOrders();
  const { data: pairs } = usePairs();
  const cancel = useCancelOrder();

  const label = useMemo(() => {
    const map = new Map((pairs ?? []).map((p) => [p.id, p.symbol]));
    return (id: string) => map.get(id) ?? id;
  }, [pairs]);

  const statusLabel = (s: OrderStatus) => {
    const key = `trading.status.${s}`;
    const l = t(key);
    return l === key ? s : l;
  };

  const fmt = (v: string) => formatDisplay(v, { locale, maxDecimals: 8, stripTrailingZeros: true });

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{t('trading.orders.title')}</h2>

      {isLoading && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={32} />)}</div>}
      {isError && <ErrorState title={t('common.error')} onRetry={() => refetch()} retryLabel={t('common.retry')} />}

      {!isLoading && !isError && (orders ?? []).length === 0 && (
        <EmptyState icon={<ChartIcon size={28} />} title={t('trading.orders.empty')} />
      )}

      {!isLoading && !isError && (orders ?? []).length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('trading.orders.pair')}</th>
              <th>{t('trading.orders.side')}</th>
              <th>{t('trading.orders.amount')}</th>
              <th>{t('trading.orders.price')}</th>
              <th>{t('trading.orders.status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).map((o: TradingOrder) => (
              <tr key={o.id}>
                <td>{label(o.tradingPairId)}</td>
                <td className={o.side === 'buy' ? styles.buyText : styles.sellText}>{t(o.side === 'buy' ? 'trading.form.buy' : 'trading.form.sell')}</td>
                <td className={styles.num}>{fmt(o.quantityRemaining)}</td>
                <td className={styles.num}>{o.price ? fmt(o.price) : t('trading.form.market')}</td>
                <td><Badge tone={STATUS_TONE[o.status] ?? 'neutral'}>{statusLabel(o.status)}</Badge></td>
                <td className={styles.cancelCell}>
                  <Button type="button" variant="secondary" size="small" onClick={() => cancel.mutate(o.id)} disabled={cancel.isPending}>
                    {t('trading.orders.cancel')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
