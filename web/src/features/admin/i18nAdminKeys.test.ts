import { describe, it, expect } from 'vitest';
import { en } from '@/shared/i18n/catalogs/en';
import { es } from '@/shared/i18n/catalogs/es';

const adminKeys = (cat: { ui: Record<string, string> }) =>
  Object.keys(cat.ui).filter((k) => k.startsWith('admin.') || k === 'nav.admin').sort();

/** Extract {{placeholder}} names from a string */
const placeholders = (s: string) => {
  const matches = s.match(/\{\{[^}]+\}\}/g) ?? [];
  return matches.sort();
};

describe('admin i18n parity', () => {
  it('every admin.* ui key exists in both en and es', () => {
    const enKeys = adminKeys(en as any);
    const esKeys = adminKeys(es as any);
    expect(enKeys).toEqual(esKeys);
    expect(enKeys.length).toBeGreaterThan(0);
  });

  it('all admin.* ui values are non-empty strings', () => {
    const enUi = (en as any).ui as Record<string, string>;
    const esUi = (es as any).ui as Record<string, string>;
    const keys = adminKeys(en as any);
    for (const k of keys) {
      expect(typeof enUi[k]).toBe('string');
      expect(enUi[k].length).toBeGreaterThan(0);
      expect(typeof esUi[k]).toBe('string');
      expect(esUi[k].length).toBeGreaterThan(0);
    }
  });

  it('interpolation placeholders match between en and es for every admin.* key', () => {
    const enUi = (en as any).ui as Record<string, string>;
    const esUi = (es as any).ui as Record<string, string>;
    const keys = adminKeys(en as any);
    for (const k of keys) {
      expect(placeholders(enUi[k])).toEqual(placeholders(esUi[k]));
    }
  });
});
