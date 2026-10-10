'use client';

import { Field } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import { usePairs } from '../queries';

export function TradingPairSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { t } = useTranslation();
  const { data: pairs, isLoading } = usePairs();
  return (
    <Field label={t('trading.pair')}>
      <select id="trading-pair" value={value} onChange={(e) => onChange(e.target.value)} disabled={isLoading}>
        <option value="">{t('trading.selectPair')}</option>
        {(pairs ?? []).map((p) => (
          <option key={p.id} value={p.id}>{p.symbol}</option>
        ))}
      </select>
    </Field>
  );
}
