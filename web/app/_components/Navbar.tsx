'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { session } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { useCurrentUser, useLogout } from '@/features/auth/queries';
import {
  SwapIcon, UsersIcon, ChartIcon, WalletIcon,
  BellIcon, UserIcon, ChevronDownIcon, LogoutIcon, MenuIcon, CloseIcon, ShieldIcon,
  SunIcon, MoonIcon, ArrowDownIcon, IconProps,
} from '@/shared/ui/icons/Icon';
import { isAdminRole } from '@/features/admin/roles';
import { useTheme } from '@/shared/theme';
import styles from './Navbar.module.css';

type NavItem = { href: string; labelKey: string; Icon: React.FC<IconProps>; authOnly?: boolean };

// V1 order: Swap · P2P · Trading · Wallet. The logged-in dashboard is the home
// itself (logo → /), like V1, so there's no separate dashboard link. Wallet shows
// only when signed in (the V1 Wallet dropdown is unified into /wallet — Caso B).
const ITEMS: NavItem[] = [
  { href: '/swap', labelKey: 'nav.swap', Icon: SwapIcon },
  { href: '/p2p', labelKey: 'nav.p2p', Icon: UsersIcon },
  { href: '/trading', labelKey: 'nav.trading', Icon: ChartIcon },
  { href: '/wallet', labelKey: 'nav.wallet', Icon: WalletIcon, authOnly: true },
];

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

export const Navbar: React.FC = () => {
  const { t } = useTranslation();
  const pathname = usePathname() || '/';
  const router = useRouter();
  const logout = useLogout();
  const { data: user } = useCurrentUser();
  const { theme, toggleTheme } = useTheme();

  // Auth is resolved client-side (the token lives in localStorage). We start
  // `false` so SSR and the first client render agree (no hydration mismatch),
  // then sync after mount and on 401/route changes.
  const [authed, setAuthed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAuthed(session.hasToken());
    const unsub = session.onUnauthorized(() => setAuthed(false));
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    setAuthed(session.hasToken());
    setUserMenuOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [userMenuOpen]);

  const onLogout = () => {
    logout();
    setAuthed(false);
    setUserMenuOpen(false);
    setMobileOpen(false);
    router.replace('/');
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const items = ITEMS.filter((it) => authed || !it.authOnly);
  const displayName = capitalize(user?.displayName || user?.username || '');

  return (
    <header className={styles.navbar}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>BitFlow</Link>

        <nav className={styles.menu} aria-label="Primary">
          {items.map(({ href, labelKey, Icon }) => (
            <Link
              key={href}
              href={href}
              className={`${styles.link} ${isActive(href) ? styles.active : ''}`}
              aria-current={isActive(href) ? 'page' : undefined}
            >
              <Icon size={18} />
              {t(labelKey)}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          {authed && (
            <Link href="/wallet?tab=deposit" className={styles.depositBtn}>
              <ArrowDownIcon size={16} />{t('nav.deposit')}
            </Link>
          )}
          <button type="button" className={styles.iconButton} aria-label={t('nav.theme')} onClick={toggleTheme}>
            {theme === 'dark' ? <SunIcon size={20} /> : <MoonIcon size={20} />}
          </button>
          {authed ? (
            <>
              <Link href="/profile" className={styles.iconButton} aria-label={t('nav.notifications')}>
                <BellIcon size={20} />
              </Link>

              <div className={styles.userMenu} ref={userMenuRef}>
                <button
                  type="button"
                  className={styles.userTrigger}
                  onClick={() => setUserMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                >
                  <span className={styles.avatar}><UserIcon size={20} /></span>
                  <span className={styles.greeting}>{t('nav.greeting', { name: displayName })}</span>
                  <ChevronDownIcon size={14} className={styles.caret} />
                </button>

                {userMenuOpen && (
                  <div className={styles.dropdown} role="menu">
                    <Link href="/profile" className={styles.dropdownItem} role="menuitem">
                      <UserIcon size={16} />{t('nav.profile')}
                    </Link>
                    {isAdminRole(user) && (
                      <Link href="/admin" className={styles.dropdownItem} role="menuitem">
                        <ShieldIcon size={16} />{t('nav.admin')}
                      </Link>
                    )}
                    <button
                      type="button"
                      className={`${styles.dropdownItem} ${styles.logoutItem}`}
                      role="menuitem"
                      onClick={onLogout}
                    >
                      <LogoutIcon size={16} />{t('nav.logout')}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className={styles.authButtons}>
              <Link href="/login" className={styles.loginBtn}>{t('nav.login')}</Link>
              <Link href="/register" className={styles.registerBtn}>{t('nav.register')}</Link>
            </div>
          )}
        </div>

        <button
          type="button"
          className={styles.hamburger}
          aria-label={t('nav.openMenu')}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div className={styles.drawer}>
          {items.map(({ href, labelKey, Icon }) => (
            <Link
              key={href}
              href={href}
              className={`${styles.drawerLink} ${isActive(href) ? styles.active : ''}`}
            >
              <Icon size={18} />{t(labelKey)}
            </Link>
          ))}
          <div className={styles.drawerDivider} />
          <button type="button" className={styles.drawerLink} onClick={toggleTheme}>
            {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}{t('nav.theme')}
          </button>
          {authed ? (
            <>
              <Link href="/wallet?tab=deposit" className={`${styles.drawerLink} ${styles.drawerDeposit}`}><ArrowDownIcon size={18} />{t('nav.deposit')}</Link>
              <Link href="/profile" className={styles.drawerLink}><UserIcon size={18} />{t('nav.profile')}</Link>
              {isAdminRole(user) && (
                <Link href="/admin" className={styles.drawerLink}><ShieldIcon size={18} />{t('nav.admin')}</Link>
              )}
              <button type="button" className={`${styles.drawerLink} ${styles.logoutItem}`} onClick={onLogout}>
                <LogoutIcon size={18} />{t('nav.logout')}
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={styles.drawerLink}>{t('nav.login')}</Link>
              <Link href="/register" className={`${styles.drawerLink} ${styles.drawerRegister}`}>{t('nav.register')}</Link>
            </>
          )}
        </div>
      )}
    </header>
  );
};
