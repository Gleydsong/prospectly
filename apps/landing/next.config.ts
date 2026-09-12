import type { NextConfig } from 'next';

import { FAQ_PERMANENT_REDIRECTS } from './src/lib/faq-routes';
import { resolveLandingOrigin, shouldFailFastNextCommand } from './src/lib/landing-origin';
import { buildLandingSecurityHeaders } from './src/lib/landing-security-headers';

if (shouldFailFastNextCommand()) {
  resolveLandingOrigin();
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/v2', destination: '/', permanent: true },
      { source: '/v2/como-funciona', destination: '/como-funciona', permanent: true },
      { source: '/v2/beneficios', destination: '/beneficios', permanent: true },
      { source: '/v2/para-quem-e', destination: '/para-quem-e', permanent: true },
      { source: '/v2/duvidas', destination: '/duvidas', permanent: true },
      ...FAQ_PERMANENT_REDIRECTS,
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: buildLandingSecurityHeaders() }];
  },
};

export default nextConfig;
