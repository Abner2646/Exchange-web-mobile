import type { Metadata } from 'next';
import { ContentPage, DraftNotice, contentStyles as s } from '../_content/ContentPage';

export const metadata: Metadata = {
  title: 'Política de Cookies',
  description: 'Cómo BitFlow usa cookies y tecnologías similares.',
};

export default function CookiesPage() {
  return (
    <ContentPage
      title="Política de Cookies"
      updated="2 de noviembre de 2026"
      lead="Cómo usamos cookies y tecnologías similares para operar y mejorar la plataforma."
    >
      <DraftNotice />

      <section className={s.section}>
        <h2 className={s.h2}>Qué son las cookies</h2>
        <p className={s.body}>
          Las cookies son pequeños archivos que se guardan en tu dispositivo y nos permiten recordar tu
          sesión y tus preferencias.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Cómo las usamos</h2>
        <ul className={s.list}>
          <li><strong>Esenciales:</strong> mantienen tu sesión iniciada y protegen la seguridad de la cuenta.</li>
          <li><strong>Preferencias:</strong> recuerdan ajustes como el tema (claro u oscuro) o el idioma.</li>
          <li><strong>Analíticas:</strong> nos ayudan a entender el uso para mejorar el producto.</li>
        </ul>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Cómo controlarlas</h2>
        <p className={s.body}>
          Podés gestionar o eliminar las cookies desde la configuración de tu navegador. Desactivar las
          cookies esenciales puede afectar el funcionamiento de la plataforma.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Contacto</h2>
        <p className={s.body}>
          Consultas: <a className={s.link} href="mailto:privacy@bitflow.community">privacy@bitflow.community</a>.
        </p>
      </section>
    </ContentPage>
  );
}
