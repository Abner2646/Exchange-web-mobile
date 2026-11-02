import type { Metadata } from 'next';
import { ContentPage, DraftNotice, contentStyles as s } from '../_content/ContentPage';

export const metadata: Metadata = {
  title: 'Términos de Servicio',
  description: 'Las condiciones de uso de la plataforma BitFlow.',
};

export default function TermsPage() {
  return (
    <ContentPage
      title="Términos de Servicio"
      updated="2 de noviembre de 2026"
      lead="Las condiciones que rigen tu uso de BitFlow. Al usar la plataforma, aceptás estos términos."
    >
      <DraftNotice />

      <section className={s.section}>
        <h2 className={s.h2}>Aceptación</h2>
        <p className={s.body}>
          Al registrarte o usar BitFlow aceptás estos Términos y nuestra Política de Privacidad. Si no estás
          de acuerdo, no uses el servicio.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Elegibilidad</h2>
        <p className={s.body}>
          Debés tener la edad legal en tu jurisdicción y no estar sujeto a sanciones ni restricciones que
          impidan usar servicios de activos digitales.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Tu cuenta</h2>
        <p className={s.body}>
          Sos responsable de la seguridad de tus credenciales y de la actividad en tu cuenta. Debés completar
          la verificación de identidad cuando se requiera.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Riesgos de los criptoactivos</h2>
        <p className={s.body}>
          El valor de los criptoactivos es volátil y podés perder fondos. Operás bajo tu propio riesgo y
          decisión. BitFlow no brinda asesoramiento financiero.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Uso permitido</h2>
        <p className={s.body}>
          No podés usar la plataforma para actividades ilícitas, fraude, lavado de activos o para eludir
          controles de cumplimiento.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Cambios</h2>
        <p className={s.body}>
          Podemos actualizar estos términos. Si el cambio es relevante, lo notificaremos por los medios
          habituales.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Contacto</h2>
        <p className={s.body}>
          Dudas sobre estos términos: <a className={s.link} href="mailto:legal@bitflow.community">legal@bitflow.community</a>.
        </p>
      </section>
    </ContentPage>
  );
}
