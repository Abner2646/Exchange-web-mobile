import React from 'react';
import styles from './content.module.css';

/** Reading-width shell for the simple public info/legal pages. Server component —
 *  these are static content, so no 'use client'. Navbar + footer come from the root layout. */
export function ContentPage({
  title,
  lead,
  updated,
  children,
}: {
  title: string;
  lead?: string;
  updated?: string;
  children?: React.ReactNode;
}) {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{title}</h1>
      {updated && <p className={styles.updated}>Última actualización: {updated}</p>}
      {lead && <p className={styles.lead}>{lead}</p>}
      {children}
    </main>
  );
}

/** Small amber draft banner reused by the legal pages (owner decision: structured
 *  placeholder + an explicit "draft, pending legal review" notice). */
export function DraftNotice() {
  return (
    <div className={styles.notice} role="note">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </svg>
      <span>Documento preliminar. Este texto es un borrador orientativo y debe ser revisado por asesoría legal antes de considerarse definitivo.</span>
    </div>
  );
}

export { styles as contentStyles };
