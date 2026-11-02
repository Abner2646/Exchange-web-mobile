import type { Metadata } from 'next';
import { ContentPage, contentStyles as s } from '../_content/ContentPage';

export const metadata: Metadata = {
  title: 'Centro de Ayuda',
  description: 'Encontrá respuestas a las preguntas más comunes sobre BitFlow o contactanos.',
};

const TOPICS = [
  { title: 'Primeros pasos', body: 'Creá tu cuenta, verificá tu email y aprendé a moverte por la plataforma.' },
  { title: 'Cuenta y seguridad', body: 'Contraseña, verificación en dos pasos y buenas prácticas para proteger tus fondos.' },
  { title: 'Billetera', body: 'Compartimentos Funding y Spot, transferencias internas y estados de tus saldos.' },
  { title: 'Trading y Swap', body: 'Cómo intercambiar criptomonedas al instante o colocar órdenes en el mercado.' },
  { title: 'P2P', body: 'Comprá y vendé entre usuarios con las protecciones de la plataforma.' },
  { title: 'Retiros y depósitos', body: 'Cómo funcionan los retiros y la disponibilidad de depósitos según tu región.' },
];

export default function HelpPage() {
  return (
    <ContentPage
      title="Centro de Ayuda"
      lead="Encontrá respuestas a las preguntas más comunes. Si no resolvés tu duda, escribinos."
    >
      <div className={s.cards}>
        {TOPICS.map((t) => (
          <div className={s.card} key={t.title}>
            <h2 className={s.cardTitle}>{t.title}</h2>
            <p className={s.cardBody}>{t.body}</p>
          </div>
        ))}
      </div>

      <section className={s.section}>
        <h2 className={s.h2}>¿Seguís con dudas?</h2>
        <p className={s.body}>
          Escribinos a <a className={s.link} href="mailto:support@bitflow.community">support@bitflow.community</a> y
          te ayudamos.
        </p>
      </section>
    </ContentPage>
  );
}
