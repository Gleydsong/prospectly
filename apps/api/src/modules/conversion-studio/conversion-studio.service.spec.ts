import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConversionEventType, ConversionPageStatus, UsageMeterKey } from '@prisma/client';

import { ConversionStudioService } from './conversion-studio.service';
import { EntitlementService } from './entitlement.service';
import { assertPublishableBlocks, parsePageBlocks } from './page-blocks.schema';

describe('page-blocks.schema', () => {
  it('rejects javascript URLs and accepts HTTPS CTA', () => {
    expect(() =>
      parsePageBlocks([
        {
          id: '11111111-1111-1111-1111-111111111111',
          type: 'cta_button',
          label: 'Go',
          action: { type: 'external_url', url: 'javascript:alert(1)' },
        },
      ]),
    ).toThrow();

    expect(() =>
      parsePageBlocks([
        {
          id: '11111111-1111-1111-1111-111111111111',
          type: 'cta_button',
          label: 'Go',
          action: { type: 'external_url', url: 'https://example.com' },
          variant: 'brand',
        },
      ]),
    ).not.toThrow();
  });

  it('requires hero/text and CTA before publish', () => {
    expect(() => assertPublishableBlocks([])).toThrow(/at least one block/);
    expect(() =>
      assertPublishableBlocks([
        {
          id: '11111111-1111-1111-1111-111111111111',
          type: 'spacer',
          size: 'md',
        },
      ]),
    ).toThrow(/hero or text/);
  });
});

describe('ConversionStudioService tenant isolation', () => {
  const entitlements = {
    assertCanCreateDraft: jest.fn(),
    assertCanPublish: jest.fn(),
    recordUsage: jest.fn(),
  };

  const makePrisma = () => {
    const prisma: {
      conversionPage: {
        findFirst: jest.Mock;
        create: jest.Mock;
        update: jest.Mock;
        count: jest.Mock;
        findMany: jest.Mock;
      };
      conversionPageVersion: { create: jest.Mock; findFirst: jest.Mock };
      conversionEvent: { create: jest.Mock; groupBy: jest.Mock; findMany: jest.Mock };
      conversionFormSubmission: { create: jest.Mock; findFirst: jest.Mock };
      lead: { findFirst: jest.Mock; update: jest.Mock };
      leadActivity: { create: jest.Mock };
      organizationMember: { findFirst: jest.Mock };
      $transaction: jest.Mock;
    } = {
      conversionPage: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      conversionPageVersion: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      conversionEvent: {
        create: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
      },
      conversionFormSubmission: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      lead: { findFirst: jest.fn(), update: jest.fn() },
      leadActivity: { create: jest.fn() },
      organizationMember: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
      }
      return arg;
    });
    return prisma;
  };

  beforeEach(() => jest.clearAllMocks());

  it('does not return another organization page', async () => {
    const prisma = makePrisma();
    prisma.conversionPage.findFirst.mockResolvedValue(null);
    const service = new ConversionStudioService(prisma as never, entitlements as never);

    await expect(service.get('org-a', 'page-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.conversionPage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'page-1', organizationId: 'org-a' }),
      }),
    );
  });

  it('rejects lead from another organization on create', async () => {
    const prisma = makePrisma();
    entitlements.assertCanCreateDraft.mockResolvedValue(undefined);
    prisma.lead.findFirst.mockResolvedValue(null);
    const service = new ConversionStudioService(prisma as never, entitlements as never);

    await expect(
      service.create('org-a', 'user-1', { title: 'Proposta', leadId: 'lead-b' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.conversionPage.create).not.toHaveBeenCalled();
  });

  it('publishes immutable version and records event', async () => {
    const prisma = makePrisma();
    entitlements.assertCanPublish.mockResolvedValue(undefined);
    entitlements.recordUsage.mockResolvedValue(undefined);
    const blocks = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        type: 'hero',
        headline: 'Olá',
        cta: { type: 'call', phone: '+5511999999999' },
        ctaLabel: 'Ligar',
        variant: 'brand',
      },
    ];
    prisma.conversionPage.findFirst.mockResolvedValue({
      id: 'page-1',
      organizationId: 'org-a',
      status: ConversionPageStatus.DRAFT,
      publishedVersion: null,
      draftBlocks: blocks,
      title: 'Proposta',
      deletedAt: null,
    });
    prisma.conversionPage.update.mockResolvedValue({
      id: 'page-1',
      status: ConversionPageStatus.PUBLISHED,
      publishedVersion: 1,
    });

    const service = new ConversionStudioService(prisma as never, entitlements as never);
    await service.publish('org-a', 'page-1', 'user-1');

    expect(prisma.conversionPageVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: 1, organizationId: 'org-a' }),
      }),
    );
    expect(prisma.conversionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: ConversionEventType.page_published }),
      }),
    );
    expect(entitlements.recordUsage).toHaveBeenCalledWith(
      'org-a',
      UsageMeterKey.PUBLISHED_PAGES,
      'publish:page-1',
    );
  });

  it('rejects concurrent draft save with stale revision', async () => {
    const prisma = makePrisma();
    prisma.conversionPage.findFirst.mockResolvedValue({
      id: 'page-1',
      organizationId: 'org-a',
      status: ConversionPageStatus.DRAFT,
      draftRevision: 3,
      deletedAt: null,
    });
    const service = new ConversionStudioService(prisma as never, entitlements as never);

    await expect(
      service.updateDraft('org-a', 'page-1', 'user-1', {
        blocks: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            type: 'rich_text',
            body: 'texto',
          },
        ],
        expectedRevision: 2,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('public form ignores organizationId from client and honeypot', async () => {
    const prisma = makePrisma();
    prisma.conversionPage.findFirst.mockResolvedValue({
      id: 'page-1',
      organizationId: 'org-a',
      publishedVersion: 2,
      leadId: null,
      createdById: 'user-1',
    });
    const service = new ConversionStudioService(prisma as never, entitlements as never);

    await expect(
      service.submitPublicForm('slug-1', { companyWebsite: 'http://spam' } as never),
    ).resolves.toEqual({ ok: true });
    expect(prisma.conversionFormSubmission.create).not.toHaveBeenCalled();
  });

  it('creates lead activity with system actor without storing form body in activity', async () => {
    const prisma = makePrisma();
    prisma.conversionPage.findFirst.mockResolvedValue({
      id: 'page-1',
      organizationId: 'org-a',
      publishedVersion: 2,
      leadId: 'lead-1',
      createdById: 'user-1',
    });
    prisma.organizationMember.findFirst.mockResolvedValue({ userId: 'user-1' });
    const service = new ConversionStudioService(prisma as never, entitlements as never);

    await expect(
      service.submitPublicForm('slug-1', {
        name: 'Ana',
        email: 'ana@example.com',
        message: 'Quero proposta',
      }),
    ).resolves.toEqual({ ok: true, message: 'Recebemos o seu contacto.' });

    expect(prisma.leadActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: 'lead-1',
          userId: 'user-1',
          type: 'NOTE',
          metadata: expect.objectContaining({
            source: 'conversion_page_form',
            fieldsPresent: expect.arrayContaining(['name', 'email', 'message']),
          }),
        }),
      }),
    );
    const activityCall = prisma.leadActivity.create.mock.calls[0]?.[0] as {
      data: { description: string; metadata: Record<string, unknown> };
    };
    expect(JSON.stringify(activityCall.data)).not.toMatch(/ana@example.com|Quero proposta/i);
  });
});

describe('EntitlementService', () => {
  it('blocks publish when quota already reached', async () => {
    const prisma = {
      organization: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          plan: 'FREE',
          planStatus: 'INACTIVE',
          currentPeriodEnd: null,
        }),
      },
      conversionPage: {
        count: jest
          .fn()
          .mockResolvedValueOnce(1) // published
          .mockResolvedValueOnce(0), // drafts
      },
      organizationMember: { count: jest.fn().mockResolvedValue(1) },
      usageLedger: { create: jest.fn() },
    };
    const service = new EntitlementService(prisma as never);
    await expect(service.assertCanPublish('org-a')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('usage ledger is idempotent on unique key', async () => {
    const prisma = {
      usageLedger: {
        create: jest.fn().mockRejectedValue({ code: 'P2002' }),
      },
    };
    const service = new EntitlementService(prisma as never);
    await expect(
      service.recordUsage('org-a', UsageMeterKey.PUBLISHED_PAGES, 'publish:page-1'),
    ).resolves.toBeUndefined();
  });
});
