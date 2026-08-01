import type { MetadataRoute } from 'next';

const base = process.env.NEXT_PUBLIC_LANDING_URL ?? 'http://localhost:3001';

export default function sitemap(): MetadataRoute.Sitemap {
  const sharedPaths = ['', '/pricing', '/faq', '/privacy', '/terms', '/cookies'];
  const intentPaths = [
    '/prospeccao-b2b',
    '/lista-de-empresas',
    '/prospeccao-para-agencias',
    '/prospeccao-para-consultorias',
  ];
  const locales = ['', '/en'];
  const entries: MetadataRoute.Sitemap = [];
  const lastModified = new Date('2026-07-31');

  for (const locale of locales) {
    for (const path of sharedPaths) {
      entries.push({
        url: `${base}${locale}${path || '/'}`,
        lastModified,
        changeFrequency: path === '' ? 'weekly' : 'monthly',
        priority: path === '' ? 1 : 0.7,
      });
    }
  }

  for (const path of intentPaths) {
    entries.push({
      url: `${base}${path}`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    });
  }

  return entries;
}
