import type { ReactNode } from 'react';

/* Line icons for the four "why choose us" features, shared by the Home and
   every design variant. Color and size come from the surrounding CSS so each
   variant can theme them; the glyphs themselves stay consistent. Index order
   matches FEATURES in data.ts. */
export const FEATURE_ICONS: ReactNode[] = [
  <svg key="swap" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M7 7h11l-2.5-2.5M17 17H6l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  <svg key="shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  <svg key="fee" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><path d="M9.2 9.3a2.4 2 0 0 1 2.8-1.3c1.4.1 2.3 1 2.3 2M12 7v10" strokeLinecap="round" /></svg>,
  <svg key="clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
];
