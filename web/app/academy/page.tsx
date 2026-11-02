import type { Metadata } from 'next';
import { ContentPage, contentStyles as s } from '../_content/ContentPage';

export const metadata: Metadata = {
  title: 'Academia',
  description: 'Aprendé sobre criptomonedas, trading y seguridad con las guías de BitFlow.',
};

const LESSONS = [
  { title: '¿Qué es una criptomoneda?', body: 'Conceptos básicos para empezar: billeteras, redes y custodia.' },
  { title: 'Cómo hacer un swap', body: 'Intercambiá una cripto por otra al instante, paso a paso.' },
  { title: 'Trading spot', body: 'Órdenes, libro de órdenes y cómo leer el mercado.' },
  { title: 'Seguridad de tu cuenta', body: 'Verificación en dos pasos, contraseñas fuertes y cómo evitar fraudes.' },
];

export default function AcademyPage() {
  return (
    <ContentPage
      title="Academia"
      lead="Guías cortas para operar con confianza. Estamos sumando contenido nuevo de forma continua."
    >
      <div className={s.cards}>
        {LESSONS.map((l) => (
          <div className={s.card} key={l.title}>
            <h2 className={s.cardTitle}>{l.title}</h2>
            <p className={s.cardBody}>{l.body}</p>
          </div>
        ))}
      </div>
    </ContentPage>
  );
}
