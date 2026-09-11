import type { MetadataRoute } from 'next';
import { resolveLandingOrigin } from '@/lib/landing-origin';

export default function robots(): MetadataRoute.Robots {
  const base = resolveLandingOrigin();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
