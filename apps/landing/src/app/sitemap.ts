import type { MetadataRoute } from 'next';
import { resolveLandingOrigin } from '@/lib/landing-origin';

const base = resolveLandingOrigin();

export default function sitemap(): MetadataRoute.Sitemap {
  const sharedPaths = ['/pricing', '/faq', '/privacy', '/terms', '/cookies'];
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
        url: `${base}${locale}${path}`,
        lastModified,
        changeFrequency: 'monthly',
        priority: 0.7,
      });
    }
  }

  entries.push(
    {
      url: `${base}/`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${base}/como-funciona`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    ...['beneficios', 'para-quem-e', 'duvidas'].map((path) => ({
      url: `${base}/${path}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  );

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
