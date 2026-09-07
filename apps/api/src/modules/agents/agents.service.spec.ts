import { BadRequestException, NotFoundException } from '@nestjs/common';

import { AgentsService } from './agents.service';
import type { PipelinesService } from '../pipelines/pipelines.service';
import type { TemplatesService } from '../campaigns/application/templates.service';
import type { OllamaChatClient } from './whatsapp-ai/ollama-chat.client';

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    lead: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ id: 'lead-1' }),
    },
    leadActivity: {
      create: jest.fn().mockResolvedValue({ id: 'act-1' }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ name: 'Ana Vendedora' }),
    },
    task: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'task-1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    pipeline: {
      findFirst: jest.fn(),
    },
    pipelineStage: {
      findFirst: jest.fn(),
    },
    messageTemplate: {
      findFirst: jest.fn(),
    },
    ...overrides,
  };
}

describe('AgentsService', () => {
  const pipelines = {
    moveLeadToStage: jest.fn(),
  } as unknown as PipelinesService;

  const templates = {
    get: jest.fn(),
  } as unknown as TemplatesService;

  const ollama = {
    generateVariants: jest.fn().mockResolvedValue(null),
    isEnabled: jest.fn().mockReturnValue(true),
  } as unknown as OllamaChatClient;

  beforeEach(() => {
    jest.clearAllMocks();
    (ollama.generateVariants as jest.Mock).mockResolvedValue(null);
  });

  it('catalog returns fixed agents', () => {
    const service = new AgentsService(makePrisma() as never, pipelines, templates, ollama);
    const result = service.catalog();
    expect(result.data.map((item) => item.id)).toEqual([
      'crm-next-action',
      'whatsapp-first-message',
    ]);
  });

  it('suggestCrm throws when lead missing', async () => {
    const prisma = makePrisma();
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue(null);
    const service = new AgentsService(prisma as never, pipelines, templates, ollama);
    await expect(service.suggestCrm('org-1', 'lead-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('suggestCrm prioritizes DNC', async () => {
    const prisma = makePrisma();
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue({
      id: 'lead-1',
      companyName: 'Acme',
      score: 90,
      status: 'NEW',
      doNotContact: true,
      phone: '5511999999999',
      whatsapp: null,
      email: 'a@b.com',
      website: 'https://acme.test',
      stageId: 'stage-1',
      stage: { id: 'stage-1', name: 'New', order: 0, pipelineId: 'pipe-1' },
      websiteRecord: null,
      owner: { id: 'u1', name: 'Owner' },
      updatedAt: new Date(),
    });
    (prisma.pipelineStage.findFirst as jest.Mock)
      .mockResolvedValueOnce({ id: 'stage-1', order: 0, pipelineId: 'pipe-1' })
      .mockResolvedValueOnce({ id: 'stage-2', name: 'Qualified', order: 1 });

    const service = new AgentsService(prisma as never, pipelines, templates, ollama);
    const result = await service.suggestCrm('org-1', 'lead-1');
    expect(result.actionCode).toBe('RESPECT_DNC');
    expect(result.canApplyStage).toBe(false);
  });

  it('whatsappFirstMessage renders template and builds waLink with text', async () => {
    const prisma = makePrisma();
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue({
      id: 'lead-1',
      companyName: 'Barbearia Norte',
      tradeName: null,
      doNotContact: false,
      phone: '+55 (11) 98888-7777',
      whatsapp: null,
      email: null,
      city: 'São Paulo',
      website: null,
      stageId: null,
      stage: null,
      websiteRecord: null,
      owner: { id: 'u1', name: 'Gui' },
      updatedAt: new Date(),
      score: 40,
      status: 'NEW',
    });
    (templates.get as jest.Mock).mockResolvedValue({
      id: 'tpl-1',
      name: 'Primeiro contacto',
      category: 'WHATSAPP',
      body: 'Olá {{companyName}}, sou {{ownerName}}.',
    });

    const service = new AgentsService(prisma as never, pipelines, templates, ollama);
    const result = await service.whatsappFirstMessage('org-1', 'user-1', 'lead-1', 'tpl-1');

    expect(result.body).toBe('Olá Barbearia Norte, sou Ana Vendedora.');
    expect(result.digits).toBe('5511988887777');
    expect(result.waLink).toContain('https://wa.me/5511988887777?text=');
    expect(result.waLink).toContain(
      encodeURIComponent('Olá Barbearia Norte, sou Ana Vendedora.'),
    );
    expect(result.autoSend).toBe(false);
  });

  it('whatsappFirstMessage rejects DNC leads', async () => {
    const prisma = makePrisma();
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue({
      id: 'lead-1',
      companyName: 'Acme',
      doNotContact: true,
      phone: '5511999999999',
      stage: null,
      websiteRecord: null,
      owner: null,
      updatedAt: new Date(),
    });
    const service = new AgentsService(prisma as never, pipelines, templates, ollama);
    await expect(
      service.whatsappFirstMessage('org-1', 'user-1', 'lead-1', 'tpl-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applyCrm moves to suggested stage when stageId omitted', async () => {
    const prisma = makePrisma();
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue({
      id: 'lead-1',
      companyName: 'Acme',
      score: 80,
      status: 'CONTACTED',
      doNotContact: false,
      phone: '5511999999999',
      whatsapp: null,
      email: 'a@b.com',
      website: 'https://acme.test',
      stageId: 'stage-1',
      stage: { id: 'stage-1', name: 'New', order: 0, pipelineId: 'pipe-1' },
      websiteRecord: { analyses: [{ id: 'a1', status: 'SUCCEEDED' }] },
      owner: { id: 'u1', name: 'Owner' },
      updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    });
    (prisma.task.count as jest.Mock).mockResolvedValue(0);
    (prisma.pipelineStage.findFirst as jest.Mock)
      .mockResolvedValueOnce({ id: 'stage-1', order: 0, pipelineId: 'pipe-1' })
      .mockResolvedValueOnce({ id: 'stage-2', name: 'Qualified', order: 1 });

    (pipelines.moveLeadToStage as jest.Mock).mockResolvedValue({
      id: 'lead-1',
      stageId: 'stage-2',
      stage: { id: 'stage-2', name: 'Qualified' },
    });

    const service = new AgentsService(prisma as never, pipelines, templates, ollama);
    const result = await service.applyCrm('org-1', 'user-1', 'lead-1');
    expect(pipelines.moveLeadToStage).toHaveBeenCalledWith(
      'org-1',
      'lead-1',
      'stage-2',
      'user-1',
    );
    expect(result.applied).toBe(true);
  });

  describe('whatsappVariants', () => {
    function leadFixture(overrides: Record<string, unknown> = {}) {
      return {
        id: 'lead-1',
        companyName: 'Salão Resenha',
        tradeName: null,
        doNotContact: false,
        phone: '+5581987950071',
        whatsapp: null,
        email: null,
        city: 'Recife',
        segment: 'Beleza',
        website: null,
        stageId: null,
        stage: null,
        websiteRecord: null,
        owner: { id: 'u1', name: 'Gui' },
        updatedAt: new Date(),
        score: 40,
        status: 'NEW',
        ...overrides,
      };
    }

    it('rejects DNC leads', async () => {
      const prisma = makePrisma();
      (prisma.lead.findFirst as jest.Mock).mockResolvedValue(leadFixture({ doNotContact: true }));
      const service = new AgentsService(prisma as never, pipelines, templates, ollama);
      await expect(service.whatsappVariants('org-1', 'user-1', 'lead-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('uses deterministic fallback when ollama returns null', async () => {
      const prisma = makePrisma();
      (prisma.lead.findFirst as jest.Mock).mockResolvedValue(leadFixture());
      const service = new AgentsService(prisma as never, pipelines, templates, ollama);
      const result = await service.whatsappVariants('org-1', 'user-1', 'lead-1', 3);
      expect(result.source).toBe('fallback');
      expect(result.variants).toHaveLength(3);
      expect(result.variants[0]?.body).toContain('Salão Resenha');
      expect(result.variants[0]?.body).toContain('Ana Vendedora');
      expect(result.variants[0]?.body).not.toContain('Gui');
      expect(result.autoSend).toBe(false);
    });

    it('rotates fallback packs when seed changes', async () => {
      const prisma = makePrisma();
      (prisma.lead.findFirst as jest.Mock).mockResolvedValue(leadFixture());
      const service = new AgentsService(prisma as never, pipelines, templates, ollama);
      const first = await service.whatsappVariants('org-1', 'user-1', 'lead-1', 4, 0);
      const second = await service.whatsappVariants('org-1', 'user-1', 'lead-1', 4, 1);
      expect(first.variants[0]?.body).not.toBe(second.variants[0]?.body);
      expect(first.variants[0]?.id).not.toBe(second.variants[0]?.id);
    });

    it('uses ollama variants when available and clamps count', async () => {
      const prisma = makePrisma();
      (prisma.lead.findFirst as jest.Mock).mockResolvedValue(leadFixture());
      (ollama.generateVariants as jest.Mock).mockResolvedValue([
        { id: 'o1', angle: 'direto', label: 'Direto', body: 'IA direto' },
        { id: 'o2', angle: 'curiosidade', label: 'Curiosidade', body: 'IA curiosidade' },
        { id: 'o3', angle: 'prova_social', label: 'Prova social', body: 'IA prova' },
        { id: 'o4', angle: 'dor_site', label: 'Dor do site', body: 'IA dor' },
      ]);
      const service = new AgentsService(prisma as never, pipelines, templates, ollama);
      const result = await service.whatsappVariants('org-1', 'user-1', 'lead-1', 99, 2);
      expect(ollama.generateVariants).toHaveBeenCalledWith(
        expect.objectContaining({ senderName: 'Ana Vendedora' }),
        5,
        2,
      );
      expect(result.source).toBe('ollama');
      expect(result.variants[0]?.body).toBe('IA direto');
    });
  });

  describe('recordOutreach', () => {
    it('records WhatsApp activity, optionally moves stage and schedules follow-up task', async () => {
      const prisma = makePrisma();
      (prisma.lead.findFirst as jest.Mock).mockResolvedValue({
        id: 'lead-1',
        companyName: 'Boutique Paris',
        doNotContact: false,
      });

      const service = new AgentsService(prisma as never, pipelines, templates, ollama);
      const result = await service.recordOutreach('org-1', 'user-1', {
        leadId: 'lead-1',
        messageBody: 'Olá! Vi a Boutique Paris...',
        variantId: 'fallback-direto-1',
        advanceStageId: 'stage-contacted',
        scheduleFollowUpDays: 2,
      });

      expect(prisma.leadActivity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-1',
          leadId: 'lead-1',
          userId: 'user-1',
          type: 'WHATSAPP',
          description: expect.stringContaining('Olá! Vi a Boutique Paris...'),
        }),
      });

      expect(pipelines.moveLeadToStage).toHaveBeenCalledWith(
        'org-1',
        'lead-1',
        'stage-contacted',
        'user-1',
      );

      expect(prisma.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-1',
          leadId: 'lead-1',
          createdById: 'user-1',
          assigneeId: 'user-1',
          title: expect.stringContaining('Boutique Paris'),
        }),
      });

      expect(result.recorded).toBe(true);
    });

    it('rejects DNC leads when recording outreach', async () => {
      const prisma = makePrisma();
      (prisma.lead.findFirst as jest.Mock).mockResolvedValue({
        id: 'lead-1',
        companyName: 'DNC Co',
        doNotContact: true,
      });

      const service = new AgentsService(prisma as never, pipelines, templates, ollama);
      await expect(
        service.recordOutreach('org-1', 'user-1', {
          leadId: 'lead-1',
          messageBody: 'test',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('dailyFocus', () => {
    it('aggregates overdue tasks, hot leads and stale leads', async () => {
      const prisma = makePrisma();
      (prisma.task.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'task-1',
          title: 'Ligar para João',
          dueAt: new Date(Date.now() - 3600000),
          lead: { id: 'lead-1', companyName: 'Oficina Central', phone: '11999999999' },
        },
      ]);
      (prisma.lead.findMany as jest.Mock)
        .mockResolvedValueOnce([
          {
            id: 'lead-2',
            companyName: 'Dentista Top',
            score: 85,
            status: 'NEW',
            phone: '11888888888',
            updatedAt: new Date(),
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'lead-3',
            companyName: 'Mercado Bom',
            score: 55,
            status: 'IN_PROGRESS',
            phone: '11777777777',
            updatedAt: new Date(Date.now() - 10 * 86400000),
          },
        ]);

      const service = new AgentsService(prisma as never, pipelines, templates, ollama);
      const result = await service.dailyFocus('org-1');

      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result.items.some((i) => i.reason === 'OVERDUE_TASK')).toBe(true);
      expect(result.items.some((i) => i.reason === 'HOT_NEW_LEAD')).toBe(true);
      expect(result.items.some((i) => i.reason === 'STALE_PIPELINE')).toBe(true);
    });
  });
});

