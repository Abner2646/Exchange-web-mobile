import { describe, it, expect } from 'vitest';
import sitemap from './sitemap';

describe('sitemap', () => {
  it('lists the public home on the canonical host and no private routes', () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain('https://bitflow.community/');
    expect(urls.some((u) => u.includes('/wallet') || u.includes('/admin'))).toBe(false);
  });
});
