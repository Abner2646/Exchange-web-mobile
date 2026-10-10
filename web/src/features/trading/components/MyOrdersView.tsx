'use client';

import { useMemo } from 'react';
import { formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { Button } from '@/shared/ui';
import { useActiveOrders, useCancelOrder, usePairs } from '../queries';
import type { TradingOrder } from '../types';
import styles from './trading.module.css';

export default function MyOrdersView() {
  const { t, locale } = useTranslation();
  const { data: orders, isLoading, isError } = useActiveOrders();
  const { data: pairs } = usePairs();
  const cancel = useCancelOrder();

  const label = useMemo(() => {
    const map = new Map((pairs ?? []).map((p) => [p.id, p.symbol]));
    return (id: string) => map.get(id) ?? id;
  }, [pairs]);

  if (isLoading) return <p className={styles.label}>{t('common.loading')}</p>;

  const rows: TradingOrder[] = isError ? [] : (orders ?? []);
  return (
    <section>
      <h2>{t('trading.orders.title')}</h2>
      {rows.length === 0 ? (
        <p className={styles.label}>{t('trading.orders.empty')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('trading.orders.pair')}</th>
              <th>{t('trading.orders.side')}</th>
              <th>{t('trading.orders.amount')}</th>
              <th>{t('trading.orders.price')}</th>
              <th>{t('trading.orders.status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td>{label(o.tradingPairId)}</td>
                <td>{t(o.side === 'buy' ? 'trading.form.buy' : 'trading.form.sell')}</td>
                <td>{formatDisplay(o.quantityRemaining, { locale, maxDecimals: 8, stripTrailingZeros: true })}</td>
                <td>{o.price ? formatDisplay(o.price, { locale, maxDecimals: 8, stripTrailingZeros: true }) : t('trading.form.market')}</td>
                <td>{o.status}</td>
                <td>
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
