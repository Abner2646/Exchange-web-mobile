'use client';

import { useTranslation } from '@/shared/i18n';
import { InfoIcon } from '@/shared/ui';
import styles from './wallet.module.css';

// Deposits are intentionally disabled for now (owner decision 2026-10-31): the screen
// shows a region-unavailable notice and does NOT wire the real on-chain deposit flow.
// The deposit-address endpoint + copy affordance stay in git history for when this is
// re-enabled; today the surface is a single honest notice.
export default function DepositView() {
  const { t } = useTranslation();

  return (
    <div className={styles.noticeCard} role="status">
      <span className={styles.noticeIcon}><InfoIcon size={24} /></span>
      <h2 className={styles.noticeTitle}>{t('wallet.deposit.unavailableTitle')}</h2>
      <p className={styles.noticeBody}>{t('wallet.deposit.unavailableBody')}</p>
    </div>
  );
}
