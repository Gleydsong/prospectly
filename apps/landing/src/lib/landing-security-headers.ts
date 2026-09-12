export const LANDING_HSTS_VALUE = 'max-age=15552000; includeSubDomains';

export type LandingSecurityEnv = {
  NODE_ENV?: string;
};

type Header = { key: string; value: string };

export function buildLandingSecurityHeaders(
  env: LandingSecurityEnv = process.env,
): Header[] {
  const isProduction = env.NODE_ENV === 'production';
  // Next/React do not eval in production. unsafe-inline stays: App Router bootstrap
  // and Motion still inject inline scripts until a nonce CSP exists.
  const scriptSrc = isProduction
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

  const headers: Header[] = [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    {
      key: 'Content-Security-Policy',
      value: [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        scriptSrc,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "connect-src 'self' ws: wss: https:",
      ].join('; '),
    },
  ];

  if (isProduction) {
    headers.push({ key: 'Strict-Transport-Security', value: LANDING_HSTS_VALUE });
  }

  return headers;
}

export function headerValue(headers: Header[], key: string): string | undefined {
  return headers.find((header) => header.key === key)?.value;
}
