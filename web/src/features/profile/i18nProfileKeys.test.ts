import { describe, it, expect } from 'vitest';
import { en } from '@/shared/i18n/catalogs/en';
import { es } from '@/shared/i18n/catalogs/es';

const profileKeys = (cat: { ui: Record<string, string> }) =>
  Object.keys(cat.ui).filter((k) => k.startsWith('profile.') || k === 'nav.profile').sort();

describe('profile i18n parity', () => {
  it('every profile.* ui key exists in both en and es', () => {
    const enKeys = profileKeys(en as any);
    const esKeys = profileKeys(es as any);
    expect(enKeys).toEqual(esKeys);
    expect(enKeys.length).toBeGreaterThan(0);
  });
});
