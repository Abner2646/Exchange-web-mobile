'use client';

// Treasury tab — HONEYPOT-ONLY. Rendered solely when the backend sends `treasuryEnabled` on
// /user/me (the real backend never does, so this never shows in the real admin panel). It
// presents hot-wallet balances, a withdraw form, and a withdrawals history whose "completed"
// rows have masked destination tails AND truncated txids (unverifiable on-chain). The attacker's
// own withdrawals always appear as pending. Nothing here moves real money.
import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { Button, Badge } from '@/shared/ui';
import { useTreasury } from '../queries';
import type { Withdrawal } from '../types';
import { WithdrawDialog } from './WithdrawDialog';
import styles from './admin.module.css';

function statusTone(s: Withdrawal['status']): 'success' | 'warning' | 'neutral' {
  return s === 'completed' ? 'success' : s === 'pending' ? 'warning' : 'neutral';
}

export function TreasuryPanel() {
  const { t, locale } = useTranslation();
  const { data, isLoading } = useTreasury();
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.panel}>
      <div className={styles.card}>
        <div className={styles.treasuryHead}>
          <div>
            <h2 className={styles.sectionTitle}>{t('admin.treasury.hotWallet')}</h2>
            <p className={styles.cardDesc}>{t('admin.treasury.custody')}: <strong>${data?.hotWallet.custodyUsd ?? '—'}</strong></p>
          </div>
          <Button variant="primary" onClick={() => setOpen(true)}>{t('admin.treasury.newWithdrawal')}</Button>
        </div>
        <div className={styles.treasuryAssets}>
          {(data?.hotWallet.assets ?? []).map((a) => (
            <div key={a.crypto} className={styles.treasuryAsset}>
              <span className={styles.treasuryAssetCrypto}>{a.crypto}</span>
              <span className={styles.mono}>{a.balance}</span>
              <span className={styles.treasuryAssetUsd}>${a.usd}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>{t('admin.treasury.history')}</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('admin.treasury.col.date')}</th>
                <th>{t('admin.treasury.col.crypto')}</th>
                <th>{t('admin.treasury.col.amount')}</th>
                <th>{t('admin.treasury.col.destination')}</th>
                <th>{t('admin.treasury.col.txid')}</th>
                <th>{t('admin.treasury.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6}>{t('common.loading')}</td></tr>
              )}
              {!isLoading && (data?.withdrawals ?? []).map((w) => (
                <tr key={w.id}>
                  <td>{new Date(w.createdAt).toLocaleString(locale)}</td>
                  <td>{w.crypto}</td>
                  <td className={styles.mono}>{w.amount}</td>
                  <td className={styles.mono}>{w.destination}</td>
                  <td className={styles.mono}>{w.txid ?? '—'}</td>
                  <td><Badge tone={statusTone(w.status)}>{t(`admin.treasury.status.${w.status}`)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <WithdrawDialog isOpen={open} onClose={() => setOpen(false)} />
    </div>
  );
}
