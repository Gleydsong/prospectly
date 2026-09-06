import type { MetadataRoute } from 'next';

import { landingRobotsRules } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_LANDING_URL ?? 'http://localhost:3001';
  return {
    rules: landingRobotsRules(),
    sitemap: `${base}/sitemap.xml`,
  };
}
