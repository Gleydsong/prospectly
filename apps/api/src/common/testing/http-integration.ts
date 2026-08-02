import type { INestApplication } from '@nestjs/common';

/**
 * Boots a Nest HTTP app bound to loopback only.
 * Avoids `listen EPERM` in sandboxed CI/dev where binding `0.0.0.0` is blocked.
 * Supertest still uses `app.getHttpServer()`; the listen host does not change API behavior.
 */
export async function initHttpIntegrationApp(app: INestApplication): Promise<INestApplication> {
  await app.init();
  await app.listen(0, '127.0.0.1');
  return app;
}
