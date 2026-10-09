'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import BalancesView from './BalancesView';
import DepositView from './DepositView';
import WithdrawForm from './WithdrawForm';
import HistoryView from './HistoryView';
import CompartmentTransferForm from './CompartmentTransferForm';
import styles from './wallet.module.css';

type Tab = 'balances' | 'deposit' | 'withdraw' | 'history';

export default function WalletTabs() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('balances');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'balances', label: t('wallet.tab.balances') },
    { id: 'deposit', label: t('wallet.tab.deposit') },
    { id: 'withdraw', label: t('wallet.tab.withdraw') },
    { id: 'history', label: t('wallet.tab.history') },
  ];

  return (
    <section>
      <h1>{t('wallet.title')}</h1>
      <div className={styles.tabs} role="tablist">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            id={`wallet-tab-${tb.id}`}
            role="tab"
            aria-selected={tab === tb.id}
            aria-controls={`wallet-panel-${tb.id}`}
            className={`${styles.tab} ${tab === tb.id ? styles.tabActive : ''}`}
            onClick={() => setTab(tb.id)}
            type="button"
          >
            {tb.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`wallet-panel-${tab}`}
        aria-labelledby={`wallet-tab-${tab}`}
      >
        {tab === 'balances' && (
          <>
            <BalancesView />
            <CompartmentTransferForm />
          </>
        )}
        {tab === 'deposit' && <DepositView />}
        {tab === 'withdraw' && <WithdrawForm />}
        {tab === 'history' && <HistoryView />}
      </div>
    </section>
  );
}
