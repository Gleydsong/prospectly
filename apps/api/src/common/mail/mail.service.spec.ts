import type { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';

import { MailService } from './mail.service';

const sendMock = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: (...args: unknown[]) => sendMock(...args),
    },
  })),
}));

const makeConfig = (values: Record<string, string | undefined>) =>
  ({
    get: (key: string) => values[key],
  }) as unknown as ConfigService;

describe('MailService', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: 're_123' }, error: null });
  });

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
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('send fails observably in production when mail is not configured', async () => {
    const service = new MailService(makeConfig({ nodeEnv: 'production' }));
    await expect(
      service.send({ to: 'a@b.dev', subject: 'Hi', text: 'Hello' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('sends through Resend with a sanitized subject and template tag', async () => {
    const service = new MailService(
      makeConfig({
        'resend.apiKey': 're_test',
        'resend.from': 'Prospectly <no-reply@prospectlyonboard.com>',
      }),
    );

    await service.send({
      to: 'ana@agency.dev',
      subject: 'Bem-vindo\nBcc: evil@x.com',
      text: 'Hello',
      html: '<p>Hello</p>',
      template: 'welcome',
    });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ana@agency.dev',
        subject: 'Bem-vindo Bcc: evil@x.com',
        html: '<p>Hello</p>',
        tags: [{ name: 'template', value: 'welcome' }],
      }),
    );
  });

  it('rejects header injection in the recipient', async () => {
    const service = new MailService(makeConfig({ 'resend.apiKey': 're_test' }));
    await expect(
      service.send({
        to: 'ana@agency.dev\nBcc:evil@x.com',
        subject: 'Hi',
        text: 'Hello',
      }),
    ).rejects.toThrow('Invalid email recipient');
    expect(sendMock).not.toHaveBeenCalled();
  });
});
