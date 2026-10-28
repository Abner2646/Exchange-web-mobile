'use client';

import { Field, Select, CoinLogo } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import { usePairs } from '../queries';
import styles from './swap.module.css';

export function PairSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { t } = useTranslation();
  const { data: pairs, isLoading } = usePairs();

  const options = (pairs ?? []).map((p) => ({
    value: p.id,
    text: `${p.baseSymbol}/${p.quoteSymbol}`,
    icon: <CoinLogo symbol={p.baseSymbol} size={22} />,
    label: (
      <span className={styles.pairLabel}>
        <strong>{p.baseSymbol}</strong>
        <span className={styles.pairQuote}>/{p.quoteSymbol}</span>
      </span>
    ),
  }));

  return (
    <Field label={t('swap.form.pair')}>
      <Select
        options={options}
        value={value || null}
        onChange={onChange}
        placeholder={isLoading ? '…' : t('swap.form.selectPair')}
        aria-label={t('swap.form.pair')}
        disabled={isLoading}
      />
    </Field>
  );
}
