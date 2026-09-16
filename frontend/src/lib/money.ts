export function formatMoney(value: string, locale: string, currency?: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return '—';

  const [, sign, whole, fraction = ''] = match;
  const normalizedWhole = whole.replace(/^0+(?=\d)/, '');
  const numberFormat = new Intl.NumberFormat(locale, currency ? { style: 'currency', currency } : undefined);
  const parts = numberFormat.formatToParts(1000.1);
  const group = parts.find((part) => part.type === 'group')?.value ?? ',';
  const decimal = parts.find((part) => part.type === 'decimal')?.value ?? '.';
  const integer = normalizedWhole.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const amount = `${sign}${integer}${fraction ? `${decimal}${fraction}` : ''}`;

  if (!currency) return amount;
  const firstInteger = parts.findIndex((part) => part.type === 'integer');
  const lastInteger = parts.length - 1 - [...parts].reverse().findIndex((part) => part.type === 'integer');
  return `${parts.slice(0, firstInteger).map((part) => part.value).join('')}${amount}${parts.slice(lastInteger + 1).map((part) => part.value).join('')}`;
}
