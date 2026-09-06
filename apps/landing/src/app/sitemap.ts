import type { MetadataRoute } from 'next';

import { buildLandingSitemap } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_LANDING_URL ?? 'http://localhost:3001';
  return buildLandingSitemap(base);
}
