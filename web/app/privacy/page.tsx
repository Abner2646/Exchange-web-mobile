import type { Metadata } from 'next';
import { ContentPage, DraftNotice, contentStyles as s } from '../_content/ContentPage';

export const metadata: Metadata = {
  title: 'Política de Privacidad',
  description: 'Cómo BitFlow recopila, usa y protege tus datos personales.',
};

export default function PrivacyPage() {
  return (
    <ContentPage
      title="Política de Privacidad"
      updated="2 de noviembre de 2026"
      lead="Cómo BitFlow recopila, usa y protege tus datos personales cuando usás la plataforma."
    >
      <DraftNotice />

      <section className={s.section}>
        <h2 className={s.h2}>Datos que recopilamos</h2>
        <p className={s.body}>
          Recopilamos los datos que nos proporcionás al crear tu cuenta y operar (identidad, contacto,
          verificación de identidad) y los datos técnicos generados por el uso del servicio (registros de
          acceso, dispositivo y actividad de transacciones).
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Cómo usamos tus datos</h2>
        <p className={s.body}>
          Usamos tus datos para operar la plataforma, verificar tu identidad, prevenir fraude y lavado de
          activos, cumplir obligaciones regulatorias y mejorar el servicio.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Compartición con terceros</h2>
        <p className={s.body}>
          No vendemos tus datos. Podemos compartirlos con proveedores que operan bajo contrato y con
          autoridades cuando la ley lo exija.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Seguridad</h2>
        <p className={s.body}>
          Aplicamos controles técnicos y organizativos para proteger tu información. Ningún sistema es
          infalible, por lo que también dependemos de que mantengas seguras tus credenciales.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Tus derechos</h2>
        <p className={s.body}>
          Según tu jurisdicción, podés solicitar acceso, corrección o eliminación de tus datos. Escribinos
          para ejercer estos derechos.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Contacto</h2>
        <p className={s.body}>
          Para consultas sobre privacidad, contactanos en <a className={s.link} href="mailto:privacy@bitflow.community">privacy@bitflow.community</a>.
        </p>
      </section>
    </ContentPage>
  );
}
