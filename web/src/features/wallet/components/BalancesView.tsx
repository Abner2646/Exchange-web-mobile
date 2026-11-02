'use client';

import { formatDisplay, compare, add } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { CoinLogo, EmptyState, ErrorState, Skeleton, WalletIcon } from '@/shared/ui';
import { useMyBalances } from '../queries';
import type { BalanceEntry } from '../types';
import styles from './wallet.module.css';

function useFmt() {
  const { locale } = useTranslation();
  return (amount: string) => formatDisplay(amount, { locale, maxDecimals: 8, minDecimals: 2 });
}

/** A single available/blocked/pending line. Zero shows muted (neutral), never red/green. */
function Line({ label, value, fmt }: { label: string; value: string; fmt: (v: string) => string }) {
  const isZero = compare(value, '0') === 0;
  return (
    <div className={styles.compRow}>
      <span className={styles.compLabel}>{label}</span>
      <span className={`${styles.compValue} ${isZero ? styles.muted : ''}`}>{fmt(value)}</span>
    </div>
  );
}

function BalanceCard({ entry }: { entry: BalanceEntry }) {
  const { t } = useTranslation();
  const fmt = useFmt();
  const symbol = entry.crypto?.symbol ?? entry.criptomonedaId;
  const name = entry.crypto?.name;
  const total = add(entry.availableBalance, entry.blockedBalance);

  return (
    <div className={styles.balanceCard}>
      <div className={styles.coinHead}>
        <CoinLogo symbol={symbol} size={32} />
        <div className={styles.coinMeta}>
          <span className={styles.coinSym}>{symbol}</span>
          {name && <span className={styles.coinName}>{name}</span>}
        </div>
        <span className={styles.coinTotal}>{fmt(total)}</span>
      </div>

      <div className={styles.compartments}>
        <div className={styles.compartment}>
          <div className={styles.compartmentHead}>{t('wallet.balances.funding')}</div>
          <Line label={t('wallet.balances.available')} value={entry.compartments.funding.available} fmt={fmt} />
          <Line label={t('wallet.balances.blocked')} value={entry.compartments.funding.blocked} fmt={fmt} />
          <Line label={t('wallet.balances.pending')} value={entry.compartments.funding.pending} fmt={fmt} />
        </div>
        <div className={styles.compartment}>
          <div className={styles.compartmentHead}>{t('wallet.balances.spot')}</div>
          <Line label={t('wallet.balances.available')} value={entry.compartments.spot.available} fmt={fmt} />
          <Line label={t('wallet.balances.blocked')} value={entry.compartments.spot.blocked} fmt={fmt} />
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className={styles.skelCard}>
      <div className={styles.skelRow}>
        <Skeleton variant="circle" width={32} height={32} />
        <Skeleton variant="text" width={80} />
        <Skeleton variant="text" width={60} style={{ marginLeft: 'auto' }} />
      </div>
      <div className={styles.compartments}>
        <Skeleton height={72} />
        <Skeleton height={72} />
      </div>
    </div>
  );
}

export default function BalancesView() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useMyBalances();

  if (isLoading) {
    return (
      <div className={styles.balanceList}>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title={t('wallet.balances.error')}
        onRetry={() => refetch()}
        retryLabel={t('common.retry')}
      />
    );
  }

  const entries: BalanceEntry[] = data ?? [];
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<WalletIcon size={28} />}
        title={t('wallet.balances.empty')}
        message={t('wallet.balances.emptyHint')}
      />
    );
  }

  return (
    <div className={styles.balanceList}>
      {entries.map((e) => (
        <BalanceCard key={e.criptomonedaId} entry={e} />
      ))}
      <p className={styles.pendingHint}>{t('wallet.balances.pendingHint')}</p>
    </div>
  );
}
