import { SdrRuntimeService } from './sdr-runtime.service';
import type { SdrRuntimeView } from './sdr-runtime.scenario';

const lead = {
  id: 'lead-1',
  companyName: 'Padaria do Centro',
  tradeName: null,
  category: 'padaria',
  segment: null,
  city: 'Recife',
  state: 'PE',
  website: 'https://padaria.example',
  phone: '+5581999999999',
  email: null,
  whatsapp: null,
  score: 60,
  websitePresence: 'WEBSITE_FOUND' as const,
  rating: 4,
  reviewCount: 15,
};

function qualifiedAnswers() {
  const score = (value: number) => ({
    type: 'score',
    score: value,
    legend: { '0': 'none', '1': 'full' },
    probabilities: { '1': value },
    confidence: 0.8,
  });
  const noul = (value: number) => ({ type: 'noul', noul: value });
  return {
    icpFit: score(0.8),
    websiteNeed: noul(0.5),
    businessActivity: noul(0.7),
    commercialOpportunity: score(0.6),
    contactability: noul(1),
    buyingSignals: noul(0),
    risk: score(0.2),
    strategy: {
      type: 'choice',
      choice: 'website_problem',
      probabilities: { website_problem: 1 },
      confidence: 0.8,
    },
    intent: { type: 'choice', choice: 'UNKNOWN', probabilities: { UNKNOWN: 1 }, confidence: 0.6 },
  };
}

describe('SdrRuntimeService', () => {
  function harness(judge: jest.Mock, initialLeads: Array<typeof lead> = [lead]) {
    let stored: SdrRuntimeView | null = null;
    const prisma = {
      sdrRuntime: {
        findUnique: jest.fn(async () => (stored ? { view: stored } : null)),
        upsert: jest.fn(
          async ({
            create,
            update,
          }: {
            create: { view: SdrRuntimeView };
            update: { view: SdrRuntimeView };
          }) => {
            stored = update?.view ?? create.view;
          },
        ),
      },
      lead: {
        findFirst: jest.fn(async ({ where }: { where: { id?: { notIn?: string[] }; doNotContact?: boolean } }) => {
          const skip = where.id?.notIn ?? [];
          return initialLeads.find((item) => !skip.includes(item.id)) ?? null;
        }),
      },
    };
    const whatsappAi = { generateVariants: jest.fn(async () => [{ body: 'Olá, vi a padaria.' }]) };
    const suppression = { isSuppressed: jest.fn().mockResolvedValue(false) };
    const service = new SdrRuntimeService(
      prisma as never,
      whatsappAi as never,
      { judge } as never,
      suppression as never,
    );
    return { service, whatsappAi, suppression, prisma };
  }

  it('asks the model to write only after Laya qualifies the customer', async () => {
    const { service, whatsappAi } = harness(jest.fn(async () => ({ answers: qualifiedAnswers() })));
    const first = await service.run('org-1');
    expect(first.decision?.qualification).toBe('QUALIFIED');
    expect(first.message.body).toBe('Olá, vi a padaria.');
    expect(whatsappAi.generateVariants).toHaveBeenCalledTimes(1);
    expect(first.autonomy.autonomousSending).toBe(false);
    expect(first.campaign.name).toBe('Fila de clientes');
    expect(JSON.stringify(first)).not.toContain('Oficina Alfa');
  });

  it('fails closed when Laya is unavailable', async () => {
    const { service, whatsappAi } = harness(
      jest.fn(async () => {
        throw new Error('laya unavailable');
      }),
    );
    const first = await service.run('org-1');
    expect(first.decision?.qualification).toBe('REJECTED');
    expect(first.message.body).toBeNull();
    expect(first.review[0]?.reason).toBe('laya_unavailable');
    expect(whatsappAi.generateVariants).not.toHaveBeenCalled();
  });

  it('fails closed on Laya timeout', async () => {
    const { service, whatsappAi } = harness(
      jest.fn(async () => {
        const error = new Error('The operation was aborted due to timeout');
        error.name = 'TimeoutError';
        throw error;
      }),
    );
    const first = await service.run('org-1');
    expect(first.decision?.qualification).toBe('REJECTED');
    expect(first.prospects[0]?.score).toBeNull();
    expect(first.message.body).toBeNull();
    expect(first.review[0]?.reason).toBe('laya_unavailable');
    expect(whatsappAi.generateVariants).not.toHaveBeenCalled();
  });

  it('fails closed on malformed Laya response', async () => {
    const { service, whatsappAi } = harness(
      jest.fn(async () => ({ answers: { invalid: 'format' } })),
    );
    const first = await service.run('org-1');
    expect(first.decision?.qualification).toBe('REJECTED');
    expect(first.prospects[0]?.score).toBeNull();
    expect(first.message.body).toBeNull();
    expect(first.review[0]?.reason).toBe('laya_unavailable');
    expect(whatsappAi.generateVariants).not.toHaveBeenCalled();
  });

  it('does not call the writer when Laya rejects the customer', async () => {
    const answers = {
      ...qualifiedAnswers(),
      icpFit: { type: 'score', score: 0.1, legend: { '0': 'none', '1': 'full' }, probabilities: { '0': 0.9 }, confidence: 0.9 },
      commercialOpportunity: { type: 'score', score: 0.1, legend: { '0': 'none', '1': 'full' }, probabilities: { '0': 0.9 }, confidence: 0.9 },
      websiteNeed: { type: 'noul', noul: 0.1 },
      contactability: { type: 'noul', noul: 0.1 },
      buyingSignals: { type: 'noul', noul: 0 },
      risk: { type: 'score', score: 0.1, legend: { '0': 'none', '1': 'full' }, probabilities: { '0': 0.9 }, confidence: 0.9 },
    };
    const { service, whatsappAi } = harness(jest.fn(async () => ({ answers })));
    const first = await service.run('org-1');
    expect(first.decision?.qualification).toBe('REJECTED');
    expect(first.message.body).toBeNull();
    expect(first.review[0]?.reason).toBe('laya_rejected');
    expect(whatsappAi.generateVariants).not.toHaveBeenCalled();
  });

  it('enforces DNC absolutely before calling Laya, skipping suppressed contacts', async () => {
    const lead1 = { ...lead, id: 'lead-1', companyName: 'Cliente DNC', phone: '+5581999990001' };
    const lead2 = { ...lead, id: 'lead-2', companyName: 'Cliente Apto', phone: '+5581999990002' };
    const judge = jest.fn(async () => ({ answers: qualifiedAnswers() }));
    const { service, whatsappAi, suppression, prisma } = harness(judge, [lead1, lead2]);

    suppression.isSuppressed.mockImplementation(async (_orgId, contact) => {
      return contact.phone === lead1.phone;
    });

    const result = await service.run('org-1');

    expect(result.prospects[0]?.id).toBe('lead-2');
    expect(result.seenLeadIds).toEqual(['lead-1', 'lead-2']);
    expect(suppression.isSuppressed).toHaveBeenCalledWith('org-1', {
      email: null,
      phone: '+5581999990001',
      domain: 'padaria.example',
    });
    // Laya must only be called for lead-2 with mounted state containing facts, NEVER with IDs or phone
    expect(judge).toHaveBeenCalledTimes(1);
    expect(judge).toHaveBeenCalledWith(
      expect.stringContaining('Negócio: Cliente Apto.'),
    );
    expect(judge).not.toHaveBeenCalledWith(
      expect.stringContaining('+5581999990002'),
    );
    expect(judge).not.toHaveBeenCalledWith(
      expect.stringContaining('lead-2'),
    );
    expect(whatsappAi.generateVariants).toHaveBeenCalledTimes(1);
    expect(prisma.sdrRuntime.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
        create: expect.objectContaining({
          view: expect.objectContaining({
            seenLeadIds: ['lead-1', 'lead-2'],
          }),
        }),
      }),
    );
  });

  it('skips and persists seenLeadIds when all remaining customers are suppressed', async () => {
    const lead1 = { ...lead, id: 'lead-1', companyName: 'Padaria Suprimida' };
    const judge = jest.fn(async () => ({ answers: qualifiedAnswers() }));
    const { service, whatsappAi, suppression, prisma } = harness(judge, [lead1]);
    suppression.isSuppressed.mockResolvedValue(true);

    const result = await service.run('org-1');

    expect(result.seenLeadIds).toEqual(['lead-1']);
    expect(result.prospects).toEqual([]);
    expect(judge).not.toHaveBeenCalled();
    expect(whatsappAi.generateVariants).not.toHaveBeenCalled();
    expect(prisma.sdrRuntime.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
        create: expect.objectContaining({
          view: expect.objectContaining({
            seenLeadIds: ['lead-1'],
          }),
        }),
      }),
    );
  });

  it('drops a saved local fixture', async () => {
    const prisma = {
      sdrRuntime: {
        findUnique: jest.fn(async () => ({
          view: {
            campaign: { name: 'Oficinas locais', status: 'ACTIVE' },
            autonomy: {
              autonomousSending: false,
              autonomousFollowup: false,
              autonomousReply: false,
            },
            prospects: [{ id: 'prospect-1', name: 'Oficina Alfa', score: 56, state: 'QUALIFIED' }],
            evidence: [],
            decision: { qualification: 'QUALIFIED', traceId: 'trace-local' },
            message: { status: 'BLOCK', body: null },
            review: [],
            metrics: { blocked: 1 },
          },
        })),
      },
      lead: { findFirst: jest.fn() },
    };
    const service = new SdrRuntimeService(
      prisma as never,
      { generateVariants: jest.fn() } as never,
      {
        judge: jest.fn(),
      } as never,
      { isSuppressed: jest.fn() } as never,
    );
    const view = await service.get('org-1');
    expect(view.prospects).toEqual([]);
  });

  it('fails closed without calling Laya when lead lacks essential name', async () => {
    const unnamedLead = { ...lead, id: 'lead-no-name', companyName: '   ', tradeName: null };
    const judge = jest.fn(async () => ({ answers: qualifiedAnswers() }));
    const { service, whatsappAi } = harness(judge, [unnamedLead]);

    const result = await service.run('org-1');

    expect(result.decision?.qualification).toBe('REJECTED');
    expect(result.review[0]?.reason).toBe('laya_unavailable');
    expect(judge).not.toHaveBeenCalled();
    expect(whatsappAi.generateVariants).not.toHaveBeenCalled();
  });

  it('loads prospect facts with strict organization scoping (RLS)', async () => {
    const findFirstMock = jest.fn(async ({ where }) => {
      if (where.organizationId === 'org-1' && where.id === 'lead-1') {
        return lead;
      }
      return null;
    });
    const prisma = {
      lead: { findFirst: findFirstMock },
      sdrRuntime: { findUnique: jest.fn(), upsert: jest.fn() },
    };
    const service = new SdrRuntimeService(
      prisma as never,
      { generateVariants: jest.fn() } as never,
      { judge: jest.fn() } as never,
      { isSuppressed: jest.fn() } as never,
    );

    const facts = await service.loadProspectFacts('org-1', 'lead-1');
    expect(facts).toEqual({
      name: 'Padaria do Centro',
      companyName: 'Padaria do Centro',
      tradeName: null,
      category: 'padaria',
      segment: null,
      city: 'Recife',
      state: 'PE',
      website: 'https://padaria.example',
      rating: 4,
      reviewCount: 15,
      hasPhone: true,
      hasEmail: false,
      hasWhatsapp: false,
    });
    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        id: 'lead-1',
        organizationId: 'org-1',
        deletedAt: null,
      },
      select: expect.any(Object),
    });

    const otherTenantFacts = await service.loadProspectFacts('org-other', 'lead-1');
    expect(otherTenantFacts).toBeNull();
  });
});
