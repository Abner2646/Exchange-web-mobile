'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/shared/i18n';
import { setPreviewKey, isPreview } from '@/shared/mirage';
import { GovernanceInbox } from './GovernanceInbox';
import { OperatorReadinessCard } from './OperatorReadinessCard';
import { UsersAdmin } from './UsersAdmin';
import { BusinessConfigEditor } from './BusinessConfigEditor';
import { AmlOps } from './AmlOps';
import { AuditViewer } from './AuditViewer';
import { HoneypotView } from './HoneypotView';
import styles from './admin.module.css';

type Tab = 'governance' | 'users' | 'config' | 'aml' | 'audit' | 'honeypot';
const TABS: Tab[] = ['governance', 'users', 'config', 'aml', 'audit', 'honeypot'];

export function AdminPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('governance');
  const [preview, setPreview] = useState(false);

  // Owner-only Mirage preview: opening /admin?mirage=<key> stores the key and reloads clean,
  // so every admin API call carries the preview header and the backend serves the FAKE panel.
  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get('mirage');
    if (key) { setPreviewKey(key); window.location.replace('/admin'); return; }
    setPreview(isPreview());
  }, []);

  const exitPreview = () => { setPreviewKey(null); window.location.replace('/admin'); };

  return (
    <section className={styles.page}>
      {preview && (
        <div className={styles.miragePreview} role="alert">
          <span>🍯 <strong>PANEL FALSO</strong> — vista previa del honeypot (Mirage). Esto es lo que ve un atacante; los datos son ficticios.</span>
          <button type="button" onClick={exitPreview} className={styles.miragePreviewExit}>Salir del preview</button>
        </div>
      )}
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

        {activeTab === 'honeypot' && <HoneypotView />}
      </div>
    </section>
  );
}
