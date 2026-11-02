import type { Metadata } from 'next';
import { ContentPage, contentStyles as s } from '../_content/ContentPage';

export const metadata: Metadata = {
  title: 'Estado del Sistema',
  description: 'Estado operativo de los servicios de BitFlow.',
};

type State = 'ok' | 'limited';
const SERVICES: { name: string; state: State; note: string }[] = [
  { name: 'Plataforma y acceso', state: 'ok', note: 'Operativo' },
  { name: 'Trading', state: 'ok', note: 'Operativo' },
  { name: 'Swap', state: 'ok', note: 'Operativo' },
  { name: 'Billetera (Funding y Spot)', state: 'ok', note: 'Operativo' },
  { name: 'P2P', state: 'ok', note: 'Operativo' },
  { name: 'Depósitos', state: 'limited', note: 'No disponible en tu región' },
];

export default function StatusPage() {
  return (
    <ContentPage
      title="Estado del Sistema"
      lead="Estado operativo de los servicios de BitFlow en tiempo real."
    >
      <div className={s.statusBanner}>
        <span className={`${s.dot}`} style={{ backgroundColor: 'var(--success)' }} />
        Todos los servicios principales funcionan con normalidad.
      </div>

      <div className={s.statusList}>
        {SERVICES.map((svc) => (
          <div className={s.statusRow} key={svc.name}>
            <span className={s.statusName}>{svc.name}</span>
            <span className={`${s.statusState} ${svc.state === 'ok' ? s.ok : s.limited}`}>
              <span className={s.dot} />
              {svc.note}
            </span>
          </div>
        ))}
      </div>
    </ContentPage>
  );
}
