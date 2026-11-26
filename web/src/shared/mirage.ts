// Mirage honeypot preview — owner-only. When a preview key is set (the owner opens
// /admin?mirage=<key>), the admin API calls carry an X-Mirage-Preview header so the backend
// serves the FAKE panel to the owner for inspection, and the admin UI shows a watermark so
// the owner always knows which panel they're looking at. An attacker never sets this.
const KEY = 'bf_mirage_preview';

export function getPreviewKey(): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.sessionStorage.getItem(KEY); } catch { return null; }
}

export function setPreviewKey(key: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (key) window.sessionStorage.setItem(KEY, key);
    else window.sessionStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

export function isPreview(): boolean {
  return !!getPreviewKey();
}
