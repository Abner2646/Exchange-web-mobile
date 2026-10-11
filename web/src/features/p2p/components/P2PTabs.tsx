'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useCurrentUser } from '@/features/auth/queries';
import { OffersList } from './OffersList';
import { OfferDetail } from './OfferDetail';
import { AcceptOfferForm } from './AcceptOfferForm';
import { MyTransactionsView } from './MyTransactionsView';
import { TransactionDetail } from './TransactionDetail';
import { CreateOfferForm } from './CreateOfferForm';
import { MyOffersView } from './MyOffersView';
import type { Offer, Transaction } from '../types';
import styles from './p2p.module.css';

type Tab = 'browse' | 'myTransactions' | 'myOffers' | 'create';
const TABS: Tab[] = ['browse', 'myTransactions', 'myOffers', 'create'];

export function P2PPage() {
  const { t } = useTranslation();
  const { data: currentUser } = useCurrentUser();
  const currentUserId = currentUser?.id ?? '';

  const [activeTab, setActiveTab] = useState<Tab>('browse');
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Accepting an offer opens a transaction → jump to My transactions and show it.
  function goToTransaction(tx: Transaction) {
    setSelectedTx(tx);
    setSelectedOffer(null);
    setActiveTab('myTransactions');
  }

  return (
    <section>
      <div className={styles.tabs} role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`${styles.tab}${activeTab === tab ? ` ${styles.tabActive}` : ''}`}
          >
            {t(`p2p.tab.${tab}`)}
          </button>
        ))}
      </div>

      {activeTab === 'browse' && (
        <div>
          <OffersList onSelectOffer={(offer) => setSelectedOffer(offer)} />
          {selectedOffer && (
            <div className={styles.panel}>
              <OfferDetail offer={selectedOffer} />
              <AcceptOfferForm offer={selectedOffer} onDone={goToTransaction} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'myTransactions' && (
        <div>
          <MyTransactionsView onSelect={(tx) => setSelectedTx(tx)} />
          {selectedTx && (
            <div className={styles.panel}>
              <TransactionDetail
                tx={selectedTx}
                currentUserId={currentUserId}
                onChanged={(tx) => setSelectedTx(tx)}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'myOffers' && <MyOffersView />}

      {activeTab === 'create' && (
        <CreateOfferForm onCreated={() => setActiveTab('myOffers')} />
      )}
    </section>
  );
}
