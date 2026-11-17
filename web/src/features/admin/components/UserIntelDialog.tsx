'use client';

import { Dialog, Badge, Skeleton } from '@/shared/ui';
import { useUserIntel } from '../queries';
import type { UserIntel, UserSignupInfo } from '../types';
import styles from './admin.module.css';

// ── Helpers ─────────────────────────────────────────────────────────────────────

function acqLabel(s: UserSignupInfo | null): string {
  if (!s || !s.acquisitionSource) return '—';
  const d = s.acquisitionDetail;
  switch (s.acquisitionSource) {
    case 'search': return `Búsqueda en ${d || 'un buscador'}`;
    case 'direct': return 'Directo (URL escrita o marcador)';
    case 'referral': return `Referido desde ${d}`;
    case 'campaign': return `Campaña: ${d}`;
    case 'social': return `Red social: ${d}`;
    case 'oauth': return 'OAuth (sin first-touch previo)';
    default: return s.acquisitionSource;
  }
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}
function fmtDate(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

type Flag = { level: 'danger' | 'warn' | 'info'; text: string };

function assess(intel: UserIntel): { verdict: 'real' | 'suspicious' | 'bot'; flags: Flag[] } {
  const s = intel.signup;
  const flags: Flag[] = [];

  if (s?.isBot) flags.push({ level: 'danger', text: 'User-Agent automatizado / bot' });
  if (s?.ipIsHosting) flags.push({ level: 'danger', text: 'IP de datacenter / hosting' });
  if (s?.ipIsProxyVpn) flags.push({ level: 'warn', text: 'IP de VPN / proxy' });

  const declared = intel.declaredCountry?.toUpperCase();
  const real = s?.ipCountryCode?.toUpperCase();
  if (declared && real && declared !== real) flags.push({ level: 'warn', text: `País declarado (${declared}) ≠ país real por IP (${real})` });
  if (!intel.user.emailVerified) flags.push({ level: 'warn', text: 'Email no verificado' });

  const a = intel.activity;
  const totalAct = (a.depositAddresses || 0) + (a.swaps || 0) + (a.orders || 0) + (a.p2pOffers || 0);
  if (totalAct === 0) flags.push({ level: 'info', text: 'Sin actividad: no depositó ni operó' });
  if (!s) flags.push({ level: 'info', text: 'Sin datos de registro (cuenta previa a la captura)' });

  let verdict: 'real' | 'suspicious' | 'bot' = 'real';
  if (s?.isBot || s?.ipIsHosting) verdict = 'bot';
  else if (flags.some((f) => f.level === 'warn')) verdict = 'suspicious';
  return { verdict, flags };
}

// ── Presentational bits ──────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.intelRow}>
      <span className={styles.intelLabel}>{label}</span>
      <span className={styles.intelValue}>{children}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.intelCard}>
      <h4 className={styles.intelCardTitle}>{title}</h4>
      {children}
    </div>
  );
}

// ── Dialog ───────────────────────────────────────────────────────────────────────

export function UserIntelDialog({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { data: intel, isLoading, isError, error } = useUserIntel(userId);

  const verdictTone = (v: string) => (v === 'bot' ? 'error' : v === 'suspicious' ? 'warning' : 'success');
  const verdictLabel = (v: string) => (v === 'bot' ? 'Probable bot' : v === 'suspicious' ? 'Sospechoso' : 'Parece real');
  const flagTone = (l: Flag['level']) => (l === 'danger' ? 'error' : l === 'warn' ? 'warning' : 'neutral');

  const a = intel ? assess(intel) : null;
  const s = intel?.signup ?? null;

  return (
    <Dialog isOpen={userId !== null} onClose={onClose} title="Ficha del usuario">
      {isLoading && <div className={styles.skelRow}><Skeleton variant="text" width="70%" /></div>}
      {isError && <p className={styles.alert} role="alert">No se pudo cargar la ficha: {(error as { message?: string } | null)?.message ?? 'error'}</p>}

      {intel && a && (
        <div className={styles.intelWrap}>
          {/* Header + verdict */}
          <div className={styles.intelHeader}>
            <div>
              <div className={styles.intelName}>{intel.user.username}</div>
              <div className={styles.intelSub}>{intel.user.email}</div>
            </div>
            <Badge tone={verdictTone(a.verdict)}>{verdictLabel(a.verdict)}</Badge>
          </div>

          {/* Flags */}
          {a.flags.length > 0 && (
            <div className={styles.intelFlags}>
              {a.flags.map((f, i) => (
                <Badge key={i} tone={flagTone(f.level)}>{f.text}</Badge>
              ))}
            </div>
          )}

          <div className={styles.intelGrid}>
            <Card title="Registro">
              <Row label="Fecha de alta">{fmtDate(intel.user.createdAt)}</Row>
              <Row label="Método">{intel.user.method === 'google' ? 'Google OAuth' : 'Email + contraseña'}</Row>
              <Row label="Email verificado">{intel.user.emailVerified ? 'Sí' : 'No'}</Row>
              <Row label="Último login">{fmtDate(intel.user.lastLoginAt)}</Row>
              <Row label="Rol">{intel.user.role}</Row>
            </Card>

            <Card title="Cómo llegó al exchange">
              <Row label="Fuente">{acqLabel(s)}</Row>
              <Row label="Referer">{fmt(s?.referer)}</Row>
              <Row label="Landing">{fmt(s?.landingPath)}</Row>
              {(s?.utmSource || s?.utmCampaign) && <Row label="UTM">{[s?.utmSource, s?.utmMedium, s?.utmCampaign].filter(Boolean).join(' / ')}</Row>}
            </Card>

            <Card title="Ubicación">
              <Row label="País declarado">{fmt(intel.declaredCountry)}</Row>
              <Row label="País real (IP)">{s?.ipCountry ? `${s.ipCountry}${s.ipCountryCode ? ` (${s.ipCountryCode})` : ''}` : (s?.geoError ? `— (${s.geoError})` : '—')}</Row>
              <Row label="Ciudad / región">{[s?.ipCity, s?.ipRegion].filter(Boolean).join(', ') || '—'}</Row>
              <Row label="ISP">{fmt(s?.ipIsp)}</Row>
              <Row label="ASN">{fmt(s?.ipAsn)}</Row>
              <Row label="VPN / proxy">{s?.ipIsProxyVpn == null ? '—' : s.ipIsProxyVpn ? 'Sí' : 'No'}</Row>
              <Row label="Datacenter">{s?.ipIsHosting == null ? '—' : s.ipIsHosting ? 'Sí' : 'No'}</Row>
            </Card>

            <Card title="Dispositivo / red">
              <Row label="IP de registro">{fmt(s?.signupIp)}</Row>
              <Row label="Navegador">{fmt(s?.browser)}</Row>
              <Row label="Sistema">{fmt(s?.os)}</Row>
              <Row label="Tipo">{fmt(s?.deviceType)}</Row>
              <Row label="¿Bot?">{s?.isBot == null ? '—' : s.isBot ? 'Sí' : 'No'}</Row>
            </Card>

            <Card title="Actividad">
              <Row label="Direcciones de depósito">{fmt(intel.activity.depositAddresses)}</Row>
              <Row label="Swaps">{fmt(intel.activity.swaps)}</Row>
              <Row label="Órdenes de trading">{fmt(intel.activity.orders)}</Row>
              <Row label="Ofertas P2P">{fmt(intel.activity.p2pOffers)}</Row>
              <Row label="KYC">{intel.user.kycVerified ? 'Verificado' : 'No'}</Row>
              <Row label="2FA">{intel.user.twoFactorEnabled ? 'Activado' : 'No'}</Row>
            </Card>
          </div>

          {!s && (
            <p className={styles.note}>Esta cuenta se creó antes de activar la captura de datos de registro, por eso no hay IP/dispositivo/origen. Los usuarios nuevos sí los tendrán.</p>
          )}
        </div>
      )}
    </Dialog>
  );
}
