export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  corsOrigins: process.env.CORS_ORIGINS ?? 'http://localhost:5173',
  openStreetMap: {
    nominatimUrl: process.env.OSM_NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org/search',
    overpassUrl: process.env.OSM_OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter',
    userAgent: process.env.OSM_USER_AGENT ?? 'Prospectly/1.0 (https://prospectly.dev)',
    timeoutMs: parseInt(process.env.OSM_TIMEOUT_MS ?? '45000', 10),
    resultLimit: parseInt(process.env.OSM_RESULT_LIMIT ?? '100', 10),
  },
  csv: {
    maxFileSizeBytes: parseInt(process.env.CSV_MAX_FILE_SIZE_BYTES ?? '5242880', 10),
    maxRows: parseInt(process.env.CSV_MAX_ROWS ?? '10000', 10),
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM ?? 'no-reply@prospectly.dev',
  },
  sentryDsn: process.env.SENTRY_DSN,
});
