import type { MetadataRoute } from 'next';

const isProd = process.env.NODE_ENV === 'production';

export default function robots(): MetadataRoute.Robots {
  // Non-production/preview hosts must not be indexed.
  if (!isProd) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/wallet', '/swap', '/trading', '/p2p', '/profile', '/admin', '/referrals'] },
    sitemap: 'https://bitflow.community/sitemap.xml',
    host: 'https://bitflow.community',
  };
}
