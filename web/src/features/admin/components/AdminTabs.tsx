'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useCurrentUser } from '@/features/auth/queries';
import { setPreviewKey } from '@/shared/mirage';
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
  const { data: user } = useCurrentUser();

  // The watermark is driven by a BACKEND marker on /user/me (`__mirage`) that the guard adds
  // ONLY in the owner-gated preview branch. An attacker who sets ?mirage=… sends the header
  // but, not being the owner, is served the normal trap response WITHOUT the marker — so the
  // banner can never leak to them. It is never a client-only decision.
  const preview = !!(user as unknown as { __mirage?: boolean })?.__mirage;

  // Opening /admin?mirage=<anything> stores the key and reloads clean, so admin API calls
  // carry the preview header and (for the owner) the backend serves the FAKE panel.
  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get('mirage');
    if (key) { setPreviewKey(key); window.location.replace('/admin'); }
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
      </div>
    </section>
  );
}
