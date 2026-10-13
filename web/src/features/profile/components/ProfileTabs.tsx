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
            {t(`profile.tab.${tab}`)}
          </button>
        ))}
      </div>

      {activeTab === 'account' && <ProfileForm />}

      {activeTab === 'security' && (
        <div className={styles.panel}>
          <section>
            <ChangePasswordForm />
          </section>
          <section>
            <EmailChangeForm />
          </section>
          <section>
            <TwoFactorSettings />
          </section>
        </div>
      )}

      {activeTab === 'notifications' && <NotificationsView />}

      {activeTab === 'kyc' && <KycStatusCard />}
    </section>
  );
}
