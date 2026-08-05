import type { ConfigService } from '@nestjs/config';
import { AppLocale } from '@prisma/client';

import type { MailService } from '../../common/mail/mail.service';
import type { PrismaService } from '../../common/prisma/prisma.service';
import { WaitlistService } from './waitlist.service';

const makePrisma = () => {
  const prisma = {
    waitlistEntry: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  return prisma as unknown as PrismaService & {
    waitlistEntry: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
};

const makeMail = () =>
  ({
    send: jest.fn().mockResolvedValue(undefined),
  }) as unknown as MailService;

const makeConfig = (notifyTo = '') =>
  ({
    get: (key: string) => (key === 'waitlist.notifyTo' ? notifyTo : undefined),
  }) as unknown as ConfigService;

describe('WaitlistService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns ok without persisting when honeypot is filled', async () => {
    const prisma = makePrisma();
    const mail = makeMail();
    const service = new WaitlistService(prisma, mail, makeConfig());

    const result = await service.join({
      email: 'bot@spam.test',
      locale: AppLocale.pt,
      website: 'https://spam.example',
    });

    expect(result.message).toBeTruthy();
    expect(prisma.waitlistEntry.findUnique).not.toHaveBeenCalled();
    expect(prisma.waitlistEntry.create).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('is idempotent for existing email (no second create or mail)', async () => {
    const prisma = makePrisma();
    const mail = makeMail();
    prisma.waitlistEntry.findUnique.mockResolvedValue({ id: 'existing', email: 'ana@agency.dev' });
    const service = new WaitlistService(prisma, mail, makeConfig());

    const result = await service.join({
      email: 'Ana@Agency.dev',
      locale: AppLocale.pt,
      source: 'landing-home',
    });

    expect(result.message).toBeTruthy();
    expect(prisma.waitlistEntry.findUnique).toHaveBeenCalledWith({
      where: { email: 'ana@agency.dev' },
    });
    expect(prisma.waitlistEntry.create).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('treats concurrent unique violations as idempotent success without mailing', async () => {
    const prisma = makePrisma();
    const mail = makeMail();
    prisma.waitlistEntry.findUnique.mockResolvedValue(null);
    prisma.waitlistEntry.create.mockRejectedValue({ code: 'P2002' });
    const service = new WaitlistService(prisma, mail, makeConfig('team@prospectly.dev'));

    const result = await service.join({
      email: 'ana@agency.dev',
      locale: AppLocale.pt,
      source: 'landing-home',
    });

    expect(result.message).toBeTruthy();
    expect(mail.send).not.toHaveBeenCalled();
    expect(prisma.waitlistEntry.update).not.toHaveBeenCalled();
  });

  it('creates entry, sends confirmation, and notifies team when configured', async () => {
    const prisma = makePrisma();
    const mail = makeMail();
    prisma.waitlistEntry.findUnique.mockResolvedValue(null);
    prisma.waitlistEntry.create.mockResolvedValue({
      id: 'w1',
      email: 'ana@agency.dev',
      locale: AppLocale.en,
    });
    prisma.waitlistEntry.update.mockResolvedValue({});
    const service = new WaitlistService(prisma, mail, makeConfig('team@prospectly.dev'));

    const result = await service.join({
      email: ' ana@agency.dev ',
      locale: AppLocale.en,
      source: 'landing-home',
    });

    expect(result.message).toBeTruthy();
    expect(prisma.waitlistEntry.create).toHaveBeenCalledWith({
      data: { email: 'ana@agency.dev', locale: AppLocale.en, source: 'landing-home' },
    });
    expect(mail.send).toHaveBeenCalledTimes(2);
    expect(mail.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: 'ana@agency.dev',
        subject: expect.stringMatching(/waitlist/i),
      }),
    );
    expect(mail.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        to: 'team@prospectly.dev',
        subject: expect.stringContaining('ana@agency.dev'),
      }),
    );
    expect(prisma.waitlistEntry.update).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: { notifiedAt: expect.any(Date) },
    });
  });
});
