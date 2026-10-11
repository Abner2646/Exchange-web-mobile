import { describe, it, expect } from 'vitest';
import { en } from '@/shared/i18n/catalogs/en';
import { es } from '@/shared/i18n/catalogs/es';

const p2pKeys = (cat: { ui: Record<string, string> }) =>
  Object.keys(cat.ui).filter((k) => k.startsWith('p2p.')).sort();

describe('p2p i18n parity', () => {
  it('every p2p.* ui key exists in both en and es', () => {
    const enKeys = p2pKeys(en as any);
    const esKeys = p2pKeys(es as any);
    expect(enKeys).toEqual(esKeys);
    expect(enKeys.length).toBeGreaterThan(0);
  });
});
