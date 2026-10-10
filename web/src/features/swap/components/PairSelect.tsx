'use client';

import { Field } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import { usePairs } from '../queries';

export function PairSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { t } = useTranslation();
  const { data: pairs, isLoading } = usePairs();

  return (
    <Field label={t('swap.form.pair')}>
      <select
        id="swap-pair"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading}
      >
        <option value="">{t('swap.form.selectPair')}</option>
        {(pairs ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.baseSymbol}/{p.quoteSymbol}{p.oraclePaused ? ' ⏸' : ''}
          </option>
        ))}
      </select>
    </Field>
  );
}
