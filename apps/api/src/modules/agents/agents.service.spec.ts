import { BadRequestException, NotFoundException } from '@nestjs/common';

import { AgentsService } from './agents.service';
import type { PipelinesService } from '../pipelines/pipelines.service';
import type { TemplatesService } from '../campaigns/application/templates.service';

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    lead: {
      findFirst: jest.fn(),
    },
    task: {
      count: jest.fn().mockResolvedValue(0),
    },
    conversionPage: {
      count: jest.fn().mockResolvedValue(0),
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('catalog returns fixed agents', () => {
    const service = new AgentsService(makePrisma() as never, pipelines, templates);
    const result = service.catalog();
    expect(result.data.map((item) => item.id)).toEqual([
      'crm-next-action',
      'whatsapp-first-message',
    ]);
  });

  it('suggestCrm throws when lead missing', async () => {
    const prisma = makePrisma();
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue(null);
    const service = new AgentsService(prisma as never, pipelines, templates);
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

    const service = new AgentsService(prisma as never, pipelines, templates);
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

    const service = new AgentsService(prisma as never, pipelines, templates);
    const result = await service.whatsappFirstMessage('org-1', 'lead-1', 'tpl-1');

    expect(result.body).toBe('Olá Barbearia Norte, sou Gui.');
    expect(result.digits).toBe('5511988887777');
    expect(result.waLink).toContain('https://wa.me/5511988887777?text=');
    expect(result.waLink).toContain(encodeURIComponent('Olá Barbearia Norte, sou Gui.'));
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
    const service = new AgentsService(prisma as never, pipelines, templates);
    await expect(
      service.whatsappFirstMessage('org-1', 'lead-1', 'tpl-1'),
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
    (prisma.conversionPage.count as jest.Mock).mockResolvedValue(1);
    (prisma.pipelineStage.findFirst as jest.Mock)
      .mockResolvedValueOnce({ id: 'stage-1', order: 0, pipelineId: 'pipe-1' })
      .mockResolvedValueOnce({ id: 'stage-2', name: 'Qualified', order: 1 });

    (pipelines.moveLeadToStage as jest.Mock).mockResolvedValue({
      id: 'lead-1',
      stageId: 'stage-2',
      stage: { id: 'stage-2', name: 'Qualified' },
    });

    const service = new AgentsService(prisma as never, pipelines, templates);
    const result = await service.applyCrm('org-1', 'user-1', 'lead-1');
    expect(pipelines.moveLeadToStage).toHaveBeenCalledWith(
      'org-1',
      'lead-1',
      'stage-2',
      'user-1',
    );
    expect(result.applied).toBe(true);
  });
});
