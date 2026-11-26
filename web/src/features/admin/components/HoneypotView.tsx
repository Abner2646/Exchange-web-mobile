'use client';

import { useState } from 'react';
import { Dialog, Badge, Skeleton } from '@/shared/ui';
import { useHoneypotStats, useHoneypotSessions, useHoneypotEvents } from '../queries';
import type { HoneypotSession, HoneypotEvent } from '../types';
import styles from './admin.module.css';

const HIGH_VALUE = new Set(['approve_withdrawal', 'escalate_role', 'register_exploit', 'attempt_withdraw', 'list_users', 'move_balance', 'delete_user', 'edit_denylist', 'change_config', 'block_user', 'raise_limit', 'view_user_intel', 'search_users']);
const triggerTone = (t: string) => (t === 'fake_exploit' ? 'error' : t === 'honeytoken' ? 'warning' : 'brand');

function fmt(d: string | null | undefined) {
  if (!d) return '—';
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '—' : x.toLocaleString();
}
function j(v: unknown) {
  if (v == null) return '';
  try { const s = JSON.stringify(v); return s === '{}' || s === 'null' ? '' : s; } catch { return ''; }
}

// ── Events drawer for one trapped session ──────────────────────────────────────
function EventsDialog({ session, onClose }: { session: HoneypotSession | null; onClose: () => void }) {
  const { data: events, isLoading } = useHoneypotEvents(session ? session.id : null);
  return (
    <Dialog isOpen={session !== null} onClose={onClose} title="Actividad del atacante">
      {session && (
        <div className={styles.intelWrap}>
          <div className={styles.intelHeader}>
            <div>
              <div className={styles.intelName}>{session.ip || '—'}</div>
              <div className={styles.intelSub}>{[session.ipCountry, session.ipIsp].filter(Boolean).join(' · ') || '—'}</div>
            </div>
            <Badge tone={triggerTone(session.trigger)}>{session.trigger}</Badge>
          </div>
          <p className={styles.note} style={{ wordBreak: 'break-all' }}>{session.reason} · UA: {session.userAgent || '—'}</p>
          {isLoading && <div className={styles.skelRow}><Skeleton variant="text" width="70%" /></div>}
          <ul className={styles.hpEventList}>
            {(events ?? []).map((e: HoneypotEvent) => {
              const payload = j(e.body) || j(e.query);
              return (
                <li key={e.id} className={styles.hpEvent}>
                  <div className={styles.hpEventTop}>
                    <span className={styles.hpTime}>{fmt(e.createdAt)}</span>
                    {e.action && <Badge tone={HIGH_VALUE.has(e.action) ? 'error' : 'neutral'}>{e.action}</Badge>
                    }
                  </div>
                  <div className={styles.hpReq}><span className={styles.hpMethod}>{e.method}</span> {e.path} <span className={styles.hpStatus}>→ {e.statusServed}</span></div>
                  {payload && <div className={styles.hpPayload}>{payload.slice(0, 500)}</div>}
                </li>
              );
            })}
            {!isLoading && (events ?? []).length === 0 && <p className={styles.note}>Sin eventos registrados.</p>}
          </ul>
        </div>
      )}
    </Dialog>
  );
}

// ── Honeypot intelligence tab ───────────────────────────────────────────────────
export function HoneypotView() {
  const { data: stats } = useHoneypotStats();
  const { data: sessions, isLoading, isError } = useHoneypotSessions();
  const [selected, setSelected] = useState<HoneypotSession | null>(null);

  return (
    <section className={styles.section}>
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Inteligencia de la trampa (Mirage)</h2>
        <p className={styles.cardDesc}>Atacantes atrapados en el honeypot y qué intentaron hacer. Data real capturada; nada de esto tocó el sistema.</p>
        {stats && (
          <div className={styles.statGrid}>
            <div className={styles.statChip}><span className={styles.statLabel}>Sesiones atrapadas</span><span className={styles.statValue}>{stats.totals.sessions}</span></div>
            <div className={styles.statChip}><span className={styles.statLabel}>Eventos capturados</span><span className={styles.statValue}>{stats.totals.events}</span></div>
            {stats.byTrigger.map((b) => (
              <div key={b.trigger} className={styles.statChip}><span className={styles.statLabel}>{b.trigger}</span><span className={styles.statValue}>{b.n}</span></div>
            ))}
          </div>
        )}
      </div>

      {isError && <p className={styles.alert} role="alert">No se pudo cargar la inteligencia del honeypot.</p>}
      {isLoading ? (
        <div className={styles.skelRow}><Skeleton variant="text" width="60%" /></div>
      ) : (sessions ?? []).length === 0 ? (
        <p className={styles.note}>Todavía no cayó nadie en la trampa.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Trigger</th><th>IP</th><th>Origen</th><th>Eventos</th><th>Último visto</th></tr>
            </thead>
            <tbody>
              {(sessions ?? []).map((s) => (
                <tr key={s.id} className={styles.row}>
                  <td><Badge tone={triggerTone(s.trigger)}>{s.trigger}</Badge></td>
                  <td className={styles.mono}>
                    <button type="button" className={styles.inspectBtn} onClick={() => setSelected(s)} title="Ver actividad">{s.ip || '—'}</button>
                  </td>
                  <td>{[s.ipCountry, s.ipIsp].filter(Boolean).join(' · ') || '—'}</td>
                  <td>{s.eventCount}</td>
                  <td>{fmt(s.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EventsDialog session={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
