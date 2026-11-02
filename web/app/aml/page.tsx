import type { Metadata } from 'next';
import { ContentPage, DraftNotice, contentStyles as s } from '../_content/ContentPage';

export const metadata: Metadata = {
  title: 'Política AML',
  description: 'El compromiso de BitFlow con la prevención de lavado de activos y el cumplimiento.',
};

export default function AmlPage() {
  return (
    <ContentPage
      title="Política de Prevención de Lavado de Activos"
      updated="2 de noviembre de 2026"
      lead="Nuestro compromiso con la prevención del lavado de activos, el financiamiento del terrorismo y el cumplimiento regulatorio."
    >
      <DraftNotice />

      <section className={s.section}>
        <h2 className={s.h2}>Marco</h2>
        <p className={s.body}>
          BitFlow aplica un programa de cumplimiento con controles de identificación de clientes, monitoreo
          de transacciones y revisión de operaciones sensibles, alineado con las obligaciones aplicables a
          las plataformas de activos digitales.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Conocé a tu cliente (KYC)</h2>
        <p className={s.body}>
          Verificamos la identidad de los usuarios antes de habilitar ciertas funciones. Podemos solicitar
          documentación adicional y actualizar la verificación de forma periódica.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Monitoreo y controles</h2>
        <p className={s.body}>
          Supervisamos la actividad para detectar patrones inusuales, y los movimientos de mayor magnitud
          requieren una aprobación de doble control (cuatro ojos) antes de ejecutarse.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Reportes y colaboración</h2>
        <p className={s.body}>
          Cuando corresponde, reportamos actividad a las autoridades competentes y colaboramos con los
          requerimientos legales aplicables.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Contacto</h2>
        <p className={s.body}>
          Consultas de cumplimiento: <a className={s.link} href="mailto:compliance@bitflow.community">compliance@bitflow.community</a>.
        </p>
      </section>
    </ContentPage>
  );
}
