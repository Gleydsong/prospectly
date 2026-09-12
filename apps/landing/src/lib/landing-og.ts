import type { Metadata } from 'next';

import { resolveLandingOrigin } from './landing-origin';

export const LANDING_OG_IMAGE_PATH = '/opengraph-image';
export const LANDING_OG_IMAGE_WIDTH = 1200;
export const LANDING_OG_IMAGE_HEIGHT = 630;
export const LANDING_OG_IMAGE_ALT = 'Prospectly';

const landingOgImage = {
  url: LANDING_OG_IMAGE_PATH,
  width: LANDING_OG_IMAGE_WIDTH,
  height: LANDING_OG_IMAGE_HEIGHT,
  alt: LANDING_OG_IMAGE_ALT,
};

export function landingOpenGraph(
  overrides: Metadata['openGraph'] = {},
): NonNullable<Metadata['openGraph']> {
  return {
    ...overrides,
    images: [landingOgImage],
  };
}

export function landingDocumentMetadata(
  env: Record<string, string | undefined> = process.env,
): Pick<Metadata, 'metadataBase' | 'icons' | 'openGraph' | 'twitter'> {
  return {
    metadataBase: new URL(resolveLandingOrigin(env)),
    icons: {
      icon: [{ url: '/brand/prospectly-mark-v2.svg', type: 'image/svg+xml' }],
      apple: [{ url: '/brand/prospectly-mark-v2.svg', type: 'image/svg+xml' }],
    },
    openGraph: landingOpenGraph(),
    twitter: {
      card: 'summary_large_image',
      images: [LANDING_OG_IMAGE_PATH],
    },
  };
}
