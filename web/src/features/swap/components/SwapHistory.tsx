'use client';

import { useMemo } from 'react';
import { formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useMySwaps, usePairs } from '../queries';
import type { MySwap } from '../types';
import styles from './swap.module.css';

export default function SwapHistory() {
  const { t, locale } = useTranslation();
  const { data: swaps, isLoading, isError } = useMySwaps();
  const { data: pairs } = usePairs();

  const label = useMemo(() => {
    const map = new Map((pairs ?? []).map((p) => [p.id, `${p.baseSymbol}/${p.quoteSymbol}`]));
    return (pairId: string) => map.get(pairId) ?? pairId;
  }, [pairs]);

  if (isLoading) return <p className={styles.label}>{t('common.loading')}</p>;
  if (isError) return <p role="alert" className={styles.label}>{t('swap.history.error')}</p>;

  const rows: MySwap[] = swaps ?? [];
  return (
    <section>
      <h2>{t('swap.history.title')}</h2>
      {rows.length === 0 ? (
        <p className={styles.label}>{t('swap.history.empty')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('swap.history.pair')}</th>
              <th>{t('swap.history.type')}</th>
              <th>{t('swap.history.amount')}</th>
              <th>{t('swap.history.date')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{label(s.pairId)}</td>
                <td>{t(s.type === 'buy' ? 'swap.form.buy' : 'swap.form.sell')}</td>
                <td>{formatDisplay(s.baseAmount, { locale, maxDecimals: 8, stripTrailingZeros: true })}</td>
                <td>{s.completedAt ?? s.createdAt ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
