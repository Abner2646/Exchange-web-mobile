'use client';

import { useState } from 'react';
import baseStyles from '../marketing.module.css';
import { FAQS } from './data';

/* Accordion shared by the Home and every design variant. Each variant passes
   its own CSS-module object via `styles`; the class-name contract is:
   faqContainer, faqItem, faqQuestion, faqActive, faqChevron, faqChevronOpen,
   faqAnswer, faqAnswerOpen. Defaults to the baseline (dark) styles. */
type FaqStyles = Record<string, string>;

function Chevron({ open, styles }: { open: boolean; styles: FaqStyles }) {
  return (
    <svg
      className={`${styles.faqChevron} ${open ? styles.faqChevronOpen : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Faq({ styles = baseStyles }: { styles?: FaqStyles }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className={styles.faqContainer}>
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q} className={styles.faqItem}>
            <button
              type="button"
              className={`${styles.faqQuestion} ${isOpen ? styles.faqActive : ''}`}
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              {f.q}
              <Chevron open={isOpen} styles={styles} />
            </button>
            <div className={`${styles.faqAnswer} ${isOpen ? styles.faqAnswerOpen : ''}`}>
              <p>{f.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
