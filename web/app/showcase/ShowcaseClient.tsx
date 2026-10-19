'use client';
import React, { useState } from 'react';
import {
  Button,
  Field,
  Input,
  Select,
  Textarea,
  Card,
  Badge,
  Table,
  Tabs,
  Tooltip,
  Skeleton,
  Spinner,
  EmptyState,
  ErrorState,
  InlineError,
  ToastProvider,
  useToast,
  WalletIcon,
  SwapIcon,
  ChartIcon,
  TrendUpIcon,
  TrendDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronDownIcon,
  CheckIcon,
  CloseIcon,
  AlertIcon,
  InfoIcon,
  ShieldIcon,
  ClockIcon,
  CopyIcon,
  SearchIcon,
  UserIcon,
  SettingsIcon,
  RefreshIcon,
  LockIcon,
  MailIcon,
  LogoutIcon,
  EyeIcon,
  MenuIcon,
  CoinLogo,
} from '@/shared/ui';
import styles from './showcase.module.css';

const ICONS = [
  ['wallet', WalletIcon], ['swap', SwapIcon], ['chart', ChartIcon], ['trendUp', TrendUpIcon],
  ['trendDown', TrendDownIcon], ['arrowUp', ArrowUpIcon], ['arrowDown', ArrowDownIcon],
  ['chevronDown', ChevronDownIcon], ['check', CheckIcon], ['close', CloseIcon], ['alert', AlertIcon],
  ['info', InfoIcon], ['shield', ShieldIcon], ['clock', ClockIcon], ['copy', CopyIcon],
  ['search', SearchIcon], ['user', UserIcon], ['settings', SettingsIcon], ['refresh', RefreshIcon],
  ['lock', LockIcon], ['mail', MailIcon], ['logout', LogoutIcon], ['eye', EyeIcon], ['menu', MenuIcon],
] as const;

const MARKET = [
  { symbol: 'BTC', name: 'Bitcoin', price: '111,979.28', d: 1.38 },
  { symbol: 'ETH', name: 'Ethereum', price: '3,995.77', d: 0.75 },
  { symbol: 'USDT', name: 'Tether', price: '1.00', d: 0.0 },
  { symbol: 'BNB', name: 'BNB', price: '624.10', d: -0.42 },
];

function Delta({ v }: { v: number }) {
  const cls = v > 0 ? styles['delta-pos'] : v < 0 ? styles['delta-neg'] : styles['delta-zero'];
  return <span className={`${cls} ${styles.num}`}>{v > 0 ? '+' : ''}{v.toFixed(2)}%</span>;
}

function ToastDemo() {
  const { toast } = useToast();
  return (
    <div className={styles.row}>
      <Button size="small" onClick={() => toast({ tone: 'success', title: 'Operación confirmada', message: 'Tu swap se ejecutó.' })}>Success</Button>
      <Button size="small" variant="danger" onClick={() => toast({ tone: 'error', title: 'No se pudo completar', message: 'Saldo insuficiente.' })}>Error</Button>
      <Button size="small" variant="secondary" onClick={() => toast({ tone: 'warning', title: 'Revisá los datos', message: 'La dirección parece incompleta.' })}>Warning</Button>
      <Button size="small" variant="ghost" onClick={() => toast({ tone: 'info', title: 'Sincronizando precios' })}>Info</Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

export default function ShowcaseClient() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [tab, setTab] = useState('overview');

  return (
    <ToastProvider>
      <div className={styles.page} data-theme={theme}>
        <header className={styles.header}>
          <div>
            <div className={styles.h1}>Primitivos — showcase</div>
            <div className={styles.lede}>Dev only · Fase A (A1–A4). Cambiá el tema para ver dark/light.</div>
          </div>
          <div className={styles.toggle}>
            <Button size="small" variant={theme === 'dark' ? 'primary' : 'secondary'} onClick={() => setTheme('dark')}>Dark</Button>
            <Button size="small" variant={theme === 'light' ? 'primary' : 'secondary'} onClick={() => setTheme('light')}>Light</Button>
          </div>
        </header>

        <main className={styles.main}>
          <Section title="Botones">
            <div className={styles.row}>
              <Button variant="primary">Primario</Button>
              <Button variant="secondary">Secundario</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Peligro</Button>
            </div>
            <div className={styles.row}>
              <Button size="small">Small</Button>
              <Button size="medium">Medium</Button>
              <Button size="large">Large</Button>
            </div>
            <div className={styles.row}>
              <Button loading>Guardando</Button>
              <Button disabled>Deshabilitado</Button>
              <Button variant="secondary" loading>Cargando</Button>
            </div>
          </Section>

          <Section title="Formulario">
            <div className={styles.grid}>
              <Field label="Email" placeholder="tu@email.com" helpText="Nunca lo compartimos." />
              <Field label="Monto" placeholder="0.00" error="Saldo insuficiente." defaultValue="9999" />
              <Field label="Moneda">
                <Select defaultValue="BTC">
                  <option value="BTC">Bitcoin (BTC)</option>
                  <option value="ETH">Ethereum (ETH)</option>
                </Select>
              </Field>
              <Field label="Nota">
                <Textarea placeholder="Opcional…" />
              </Field>
            </div>
          </Section>

          <Section title="Cards">
            <div className={styles.grid}>
              <Card>Card por defecto</Card>
              <Card variant="quiet">Card tranquila</Card>
              <Card interactive>Card interactiva (hover)</Card>
              <Card padding="lg">Card padding lg</Card>
            </div>
          </Section>

          <Section title="Badges">
            <div className={styles.row}>
              <Badge tone="brand">Nuevo</Badge>
              <Badge tone="success">Completado</Badge>
              <Badge tone="error">Rechazado</Badge>
              <Badge tone="warning">Pendiente</Badge>
              <Badge tone="neutral">Borrador</Badge>
            </div>
          </Section>

          <Section title="Tabla">
            <Table>
              <thead>
                <tr><th>Moneda</th><th data-num>Precio</th><th data-num>24h %</th></tr>
              </thead>
              <tbody>
                {MARKET.map((c) => (
                  <tr key={c.symbol}>
                    <td>
                      <span className={styles.row} style={{ gap: '0.5rem' }}>
                        <CoinLogo symbol={c.symbol} size={24} />
                        <span><strong>{c.symbol}</strong> · {c.name}</span>
                      </span>
                    </td>
                    <td data-num className={styles.num}>${c.price}</td>
                    <td data-num><Delta v={c.d} /></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Section>

          <Section title="Tabs">
            <Tabs
              aria-label="Secciones de ejemplo"
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'overview', label: 'Resumen' },
                { id: 'activity', label: 'Actividad' },
                { id: 'settings', label: 'Ajustes' },
              ]}
            />
            <Card variant="quiet">Panel activo: <strong>{tab}</strong></Card>
          </Section>

          <Section title="Tooltip">
            <Tooltip content="Los retiros grandes pasan por aprobación dual.">
              <Button variant="ghost" size="small">¿Por qué tarda?</Button>
            </Tooltip>
          </Section>

          <Section title="Toast">
            <ToastDemo />
          </Section>

          <Section title="Loading — Skeleton & Spinner">
            <div className={styles.row}>
              <Skeleton width={180} height={44} radius="var(--radius-md)" />
              <Skeleton variant="circle" width={48} height={48} />
              <div style={{ flex: 1, maxWidth: 240, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton variant="text" width="80%" />
                <Skeleton variant="text" width="60%" />
              </div>
            </div>
            <div className={styles.row}>
              <Spinner size={18} />
              <Spinner size={28} />
              <Spinner size={40} />
            </div>
          </Section>

          <Section title="Empty & Error">
            <div className={styles.grid}>
              <Card>
                <EmptyState
                  icon={<WalletIcon size={24} />}
                  title="Todavía no tenés movimientos"
                  message="Hacé tu primer depósito para empezar a operar."
                  action={<Button size="small">Depositar</Button>}
                />
              </Card>
              <Card>
                <ErrorState
                  title="No pudimos cargar tus saldos"
                  message="Revisá tu conexión e intentá de nuevo."
                  onRetry={() => {}}
                />
              </Card>
            </div>
            <InlineError>La dirección no es válida para esta red.</InlineError>
          </Section>

          <Section title="Iconografía">
            <div className={styles.iconGrid}>
              {ICONS.map(([name, Ico]) => (
                <div key={name} className={styles.iconCell}>
                  <Ico size={22} />
                  {name}
                </div>
              ))}
            </div>
          </Section>

          <Section title="CoinLogo">
            <div className={styles.row}>
              {['BTC', 'ETH', 'SOL', 'XRP', 'USDC', 'WXYZ'].map((s) => (
                <span key={s} className={styles.row} style={{ gap: '0.5rem' }}>
                  <CoinLogo symbol={s} />
                  <span className={styles.num}>{s}</span>
                </span>
              ))}
            </div>
          </Section>
        </main>
      </div>
    </ToastProvider>
  );
}
