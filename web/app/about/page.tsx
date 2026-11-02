import type { Metadata } from 'next';
import { ContentPage, contentStyles as s } from '../_content/ContentPage';

export const metadata: Metadata = {
  title: 'Sobre Nosotros',
  description: 'BitFlow es un exchange de criptomonedas custodial con controles de grado auditoría.',
};

export default function AboutPage() {
  return (
    <ContentPage
      title="Sobre BitFlow"
      lead="Un exchange de criptomonedas custodial, pensado desde el primer día con controles de grado auditoría."
    >
      <section className={s.section}>
        <h2 className={s.h2}>Qué hacemos</h2>
        <p className={s.body}>
          BitFlow te permite comprar, intercambiar y operar criptomonedas de forma simple y segura. Como
          exchange custodial, resguardamos los activos para que vos te concentres en operar.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Seguridad y cumplimiento</h2>
        <p className={s.body}>
          La seguridad no es un agregado: es la base. Operamos con un registro contable de doble entrada,
          monitoreo para prevención de lavado de activos, una pista de auditoría a prueba de alteraciones y
          aprobación de cuatro ojos para los movimientos más sensibles.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Contacto</h2>
        <p className={s.body}>
          ¿Querés saber más? Escribinos a <a className={s.link} href="mailto:hello@bitflow.community">hello@bitflow.community</a>.
        </p>
      </section>
    </ContentPage>
  );
}
