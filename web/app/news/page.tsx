import type { Metadata } from 'next';
import { ContentPage, contentStyles as s } from '../_content/ContentPage';

export const metadata: Metadata = {
  title: 'Noticias',
  description: 'Novedades y anuncios de BitFlow.',
};

export default function NewsPage() {
  return (
    <ContentPage title="Noticias" lead="Novedades, anuncios y cambios del producto.">
      <div className={s.empty}>
        <svg className={s.emptyIcon} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 22V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16l-3-2-3 2-3-2-3 2-2 0Z" />
          <path d="M8 7h8M8 11h8M8 15h5" />
        </svg>
        <p className={s.emptyText}>Todavía no hay novedades. Volvé pronto para ver los anuncios de BitFlow.</p>
      </div>
    </ContentPage>
  );
}
