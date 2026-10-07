import type { MetadataRoute } from 'next';

const BASE = 'https://bitflow.community';

export default function sitemap(): MetadataRoute.Sitemap {
  // Only public, indexable routes. The authenticated app (wallet/swap/trading/
  // admin/…) is deliberately excluded. Add public content pages (fees/FAQ/per-asset)
  // here as they are built in later slices.
  return [
    { url: `${BASE}/`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
  ];
}
