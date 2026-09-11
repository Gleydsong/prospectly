import { stripEnvString } from './env-string';

export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: process.env.DATABASE_URL,
  databaseAppUrl: process.env.DATABASE_APP_URL,
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  refreshCookie: {
    sameSite: process.env.REFRESH_COOKIE_SAME_SITE,
  },
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  landingUrl:
    process.env.FRONTEND_LANDING_URL ?? process.env.LANDING_URL ?? 'https://prospectlyonboard.com',
  corsOrigins:
    process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001',
  google: {
    clientId: stripEnvString(process.env.GOOGLE_CLIENT_ID),
    clientSecret: stripEnvString(process.env.GOOGLE_CLIENT_SECRET),
    oauthRedirectUri: stripEnvString(
      process.env.GOOGLE_OAUTH_REDIRECT_URI,
      'http://localhost:3000/api/v1/google-connections/callback',
    ),
    tokenEncryptionKey: stripEnvString(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY),
  },
  openStreetMap: {
    nominatimUrl: process.env.OSM_NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org/search',
    overpassUrl: process.env.OSM_OVERPASS_URL ?? 'https://lz4.overpass-api.de/api/interpreter',
    userAgent: process.env.OSM_USER_AGENT ?? 'Prospectly/1.0 (https://prospectly.dev)',
    // Keep client abort below typical overloaded-public-mirror hangs; fail over mirrors instead.
    timeoutMs: parseInt(process.env.OSM_TIMEOUT_MS ?? '20000', 10),
    resultLimit: parseInt(process.env.OSM_RESULT_LIMIT ?? '100', 10),
  },
  googlePlaces: {
    apiKey: process.env.GOOGLE_PLACES_API_KEY ?? '',
    baseUrl: process.env.GOOGLE_PLACES_BASE_URL ?? 'https://places.googleapis.com/v1',
    timeoutMs: parseInt(process.env.GOOGLE_PLACES_TIMEOUT_MS ?? '30000', 10),
    resultLimit: parseInt(process.env.GOOGLE_PLACES_RESULT_LIMIT ?? '20', 10),
  },
  csv: {
    maxFileSizeBytes: parseInt(process.env.CSV_MAX_FILE_SIZE_BYTES ?? '5242880', 10),
    maxRows: parseInt(process.env.CSV_MAX_ROWS ?? '10000', 10),
  },
  websiteAnalysis: {
    timeoutMs: parseInt(process.env.WEBSITE_ANALYSIS_TIMEOUT_MS ?? '10000', 10),
    maxBodyBytes: parseInt(process.env.WEBSITE_ANALYSIS_MAX_BODY_BYTES ?? '1500000', 10),
    maxRedirects: parseInt(process.env.WEBSITE_ANALYSIS_MAX_REDIRECTS ?? '5', 10),
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM ?? 'no-reply@prospectly.dev',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY ?? '',
    from: process.env.RESEND_FROM ?? process.env.SMTP_FROM ?? 'no-reply@prospectly.dev',
  },
  waitlist: {
    notifyTo: process.env.WAITLIST_NOTIFY_TO ?? '',
  },
  billing: {
    pixProvider: process.env.PIX_PROVIDER ?? 'ASAAS',
  },
  asaas: {
    enabled: process.env.ASAAS_ENABLED === 'true',
    apiKey: process.env.ASAAS_API_KEY?.trim() ?? '',
    webhookToken: process.env.ASAAS_WEBHOOK_TOKEN?.trim() ?? '',
    apiBaseUrl: process.env.ASAAS_API_BASE_URL ?? 'https://api-sandbox.asaas.com/v3',
    httpTimeoutMs: parseInt(process.env.ASAAS_HTTP_TIMEOUT_MS ?? '15000', 10),
  },
  ops: {
    metricsToken: process.env.OPS_METRICS_TOKEN ?? '',
  },
  sentryDsn: process.env.SENTRY_DSN,
  whatsappAi: {
    enabled: process.env.WHATSAPP_AI_ENABLED !== 'false',
    baseUrl: process.env.WHATSAPP_AI_BASE_URL ?? 'http://127.0.0.1:11434',
    // Qwen3 is stronger for PT-BR prospecting copy than llama3.2; override via WHATSAPP_AI_MODEL.
    model: process.env.WHATSAPP_AI_MODEL ?? 'qwen3:8b',
    timeoutMs: parseInt(process.env.WHATSAPP_AI_TIMEOUT_MS ?? '30000', 10),
    apiKey: process.env.WHATSAPP_AI_API_KEY ?? '',
  },
  opportunityAi: {
    enabled: process.env.OPPORTUNITY_AI_ENABLED !== 'false',
    baseUrl:
      process.env.OPPORTUNITY_AI_BASE_URL ??
      process.env.WHATSAPP_AI_BASE_URL ??
      'http://127.0.0.1:11434',
    model: process.env.OPPORTUNITY_AI_MODEL ?? process.env.WHATSAPP_AI_MODEL ?? 'qwen3:8b',
    timeoutMs: parseInt(process.env.OPPORTUNITY_AI_TIMEOUT_MS ?? '25000', 10),
    apiKey: process.env.OPPORTUNITY_AI_API_KEY ?? process.env.WHATSAPP_AI_API_KEY ?? '',
  },
});
