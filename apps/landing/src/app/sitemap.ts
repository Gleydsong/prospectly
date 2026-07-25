import type { MetadataRoute } from 'next';

const base = process.env.NEXT_PUBLIC_LANDING_URL ?? 'http://localhost:3001';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['', '/pricing', '/privacy', '/terms', '/cookies'];
  const locales = ['', '/en'];
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of locales) {
    for (const path of paths) {
      entries.push({
        url: `${base}${locale}${path || '/'}`,
        lastModified: new Date('2026-07-25'),
        changeFrequency: path === '' ? 'weekly' : 'monthly',
        priority: path === '' ? 1 : 0.7,
      });
    }
  }
  return entries;
}
