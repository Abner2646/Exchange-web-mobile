'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { GovernanceInbox } from './GovernanceInbox';
import { OperatorReadinessCard } from './OperatorReadinessCard';
import { UsersAdmin } from './UsersAdmin';
import { BusinessConfigEditor } from './BusinessConfigEditor';
import { AmlOps } from './AmlOps';
import { AuditViewer } from './AuditViewer';
import styles from './admin.module.css';

type Tab = 'governance' | 'users' | 'config' | 'aml' | 'audit';
const TABS: Tab[] = ['governance', 'users', 'config', 'aml', 'audit'];

export function AdminPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('governance');

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('admin.title')}</h1>
        <p className={styles.subtitle}>{t('admin.subtitle')}</p>
      </header>

      <div className={styles.tabs} role="tablist" aria-label={t('admin.title')}>
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`admin-tab-${tab}`}
            aria-selected={activeTab === tab}
            aria-controls={`admin-panel-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={`${styles.tab}${activeTab === tab ? ` ${styles.tabActive}` : ''}`}
          >
            {t(`admin.tab.${tab}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`admin-panel-${activeTab}`} aria-labelledby={`admin-tab-${activeTab}`}>
        {activeTab === 'governance' && (
          <div className={styles.panel}>
            <GovernanceInbox />
            <OperatorReadinessCard />
          </div>
        )}

        {activeTab === 'users' && <UsersAdmin />}

        {activeTab === 'config' && <BusinessConfigEditor />}

        {activeTab === 'aml' && <AmlOps />}

        {activeTab === 'audit' && <AuditViewer />}
      </div>
    </section>
  );
}
