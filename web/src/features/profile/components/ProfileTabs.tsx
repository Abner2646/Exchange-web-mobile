'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { ProfileForm } from './ProfileForm';
import { ChangePasswordForm } from './ChangePasswordForm';
import { EmailChangeForm } from './EmailChangeForm';
import { TwoFactorSettings } from './TwoFactorSettings';
import { NotificationsView } from './NotificationsView';
import { KycStatusCard } from './KycStatusCard';
import styles from './profile.module.css';

type Tab = 'account' | 'security' | 'notifications' | 'kyc';
const TABS: Tab[] = ['account', 'security', 'notifications', 'kyc'];

export function ProfilePage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('account');

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('profile.title')}</h1>
        <p className={styles.subtitle}>{t('profile.subtitle')}</p>
      </header>

      <div className={styles.tabs} role="tablist" aria-label={t('profile.title')}>
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`profile-tab-${tab}`}
            aria-selected={activeTab === tab}
            aria-controls={`profile-panel-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={`${styles.tab}${activeTab === tab ? ` ${styles.tabActive}` : ''}`}
          >
            {t(`profile.tab.${tab}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`profile-panel-${activeTab}`} aria-labelledby={`profile-tab-${activeTab}`}>
        {activeTab === 'account' && <ProfileForm />}

        {activeTab === 'security' && (
          <div className={styles.panel}>
            <ChangePasswordForm />
            <EmailChangeForm />
            <TwoFactorSettings />
          </div>
        )}

        {activeTab === 'notifications' && <NotificationsView />}

        {activeTab === 'kyc' && <KycStatusCard />}
      </div>
    </section>
  );
}
