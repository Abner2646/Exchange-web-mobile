// First-touch attribution: captured on the user's VERY FIRST visit (before they navigate
// around or bounce through Google OAuth), so the backend can record HOW they found the
// exchange — organic search, a referral, a campaign, or direct. Persisted in localStorage
// and read at signup: sent in the register body and carried through Google OAuth via state.

const KEY = 'bf_ft';

export interface FirstTouch {
  referer?: string;
  landing?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  ua?: string;
  ts?: number;
}

/** Record the first-touch once; never overwrites a prior visit's value. */
export function captureFirstTouch(): void {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(KEY)) return;
    const p = new URLSearchParams(window.location.search);
    const ft: FirstTouch = {
      referer: document.referrer || '',
      landing: window.location.pathname + window.location.search,
      utmSource: p.get('utm_source') || undefined,
      utmMedium: p.get('utm_medium') || undefined,
      utmCampaign: p.get('utm_campaign') || undefined,
      ua: navigator.userAgent,
      ts: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(ft));
  } catch {
    /* localStorage blocked — attribution is best-effort */
  }
}

export function getFirstTouch(): FirstTouch | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FirstTouch) : undefined;
  } catch {
    return undefined;
  }
}

/** Base64 (UTF-8 safe) of the first-touch, for carrying through the Google OAuth `state`. */
export function getFirstTouchB64(): string | undefined {
  const ft = getFirstTouch();
  if (!ft) return undefined;
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(ft))));
  } catch {
    return undefined;
  }
}
