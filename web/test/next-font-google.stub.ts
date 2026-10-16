/* Test stub for `next/font/google`, wired via a resolve alias in
   vitest.config.ts. The real loader only runs inside the Next build pipeline;
   under vitest its module graph is heavy enough that esbuild stalls while
   transforming it during collection. Aliasing to this stub means the real
   module is never resolved or transformed.

   Each export is a loader function returning the shape Next produces
   (className + style + variable). Named exports are explicit so static
   `import { Manrope, Inter } from 'next/font/google'` resolves at transform
   time; add any new font here when a page starts using it. */
type NextFont = { className: string; style: { fontFamily: string }; variable: string };
const font = (): NextFont => ({ className: 'mock-font', style: { fontFamily: 'mock-font' }, variable: 'mock-font' });

export const Manrope = font;
export const Inter = font;
export const Bricolage_Grotesque = font;
export const Rajdhani = font;
export const Roboto_Mono = font;
export const Syne = font;
export const Plus_Jakarta_Sans = font;
export const Space_Grotesk = font;

export default font;
