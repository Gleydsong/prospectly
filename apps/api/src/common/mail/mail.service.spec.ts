import type { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';

import { MailService } from './mail.service';

const makeConfig = (values: Record<string, string | undefined>) =>
  ({
    get: (key: string) => values[key],
  }) as unknown as ConfigService;

describe('MailService', () => {
  it('isConfigured is true when Resend key exists', () => {
    const service = new MailService(makeConfig({ 'resend.apiKey': 're_test' }));
    expect(service.isConfigured()).toBe(true);
  });

  it('isConfigured is true when SMTP host exists', () => {
    const service = new MailService(makeConfig({ 'smtp.host': 'smtp.example.com' }));
    expect(service.isConfigured()).toBe(true);
  });

  it('isConfigured is false without providers', () => {
    const service = new MailService(makeConfig({}));
    expect(service.isConfigured()).toBe(false);
  });

  it('send no-ops in development when mail is not configured', async () => {
    const service = new MailService(makeConfig({ nodeEnv: 'development' }));
    await expect(
      service.send({ to: 'a@b.dev', subject: 'Hi', text: 'Hello' }),
    ).resolves.toBeUndefined();
  });

  it('send fails observably in production when mail is not configured', async () => {
    const service = new MailService(makeConfig({ nodeEnv: 'production' }));
    await expect(
      service.send({ to: 'a@b.dev', subject: 'Hi', text: 'Hello' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
