'use client';

import { Select, CoinLogo } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import { formatDisplay } from '@/shared/money';
import { usePairs } from '../queries';

export function TradingPairSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { t, locale } = useTranslation();
  const { data: pairs } = usePairs();

  const options = (pairs ?? []).map((p) => ({
    value: p.id,
    text: p.symbol,
    icon: <CoinLogo symbol={p.baseSymbol} size={22} />,
    label: <strong>{p.symbol}</strong>,
    meta: p.lastPrice ? formatDisplay(p.lastPrice, { locale, maxDecimals: 8, stripTrailingZeros: true }) : undefined,
  }));

  return (
    <Select
      options={options}
      value={value || null}
      onChange={onChange}
      aria-label={t('trading.pair')}
      placeholder={t('trading.selectPair')}
      searchable
      searchPlaceholder={t('trading.pair')}
    />
  );
}
