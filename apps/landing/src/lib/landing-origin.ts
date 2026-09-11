export const DEV_LANDING_ORIGIN = 'http://localhost:3001';

const PRODUCTION_ORIGIN_ERROR =
  'NEXT_PUBLIC_LANDING_URL must be a public https origin in production';

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost');
}

export function shouldFailFastNextCommand(argv: readonly string[] = process.argv): boolean {
  const idx = argv.findIndex((arg) => arg === 'next' || arg.endsWith('/next'));
  const subcommand = idx >= 0 ? argv[idx + 1] : undefined;
  return subcommand === 'build' || subcommand === 'start';
}

export function resolveLandingOrigin(
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = env.NEXT_PUBLIC_LANDING_URL?.trim() ?? '';
  const isProduction = env.NODE_ENV === 'production';

  if (!raw) {
    if (isProduction) {
      throw new Error(`${PRODUCTION_ORIGIN_ERROR} (received: <empty>)`);
    }
    return DEV_LANDING_ORIGIN;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${PRODUCTION_ORIGIN_ERROR} (received: ${raw})`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${PRODUCTION_ORIGIN_ERROR} (received: ${raw})`);
  }

  if (isProduction && (parsed.protocol !== 'https:' || isLoopbackHost(parsed.hostname))) {
    throw new Error(`${PRODUCTION_ORIGIN_ERROR} (received: ${raw})`);
  }

  return parsed.origin;
}
