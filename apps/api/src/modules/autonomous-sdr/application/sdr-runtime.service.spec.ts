import { SdrRuntimeService } from './sdr-runtime.service';
import type { SdrRuntimeView } from './sdr-runtime.scenario';

const lead = {
  id: 'lead-1',
  companyName: 'Padaria do Centro',
  tradeName: null,
  category: 'padaria',
  segment: null,
  city: 'Recife',
  website: 'https://padaria.example',
  phone: '+5581999999999',
  email: null,
  whatsapp: null,
  score: 60,
  websitePresence: 'WEBSITE_FOUND' as const,
  rating: 4,
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
  function harness(judge: jest.Mock) {
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
        findFirst: jest.fn(async ({ where }: { where: { id?: { notIn: string[] } } }) => {
          const skip = where.id?.notIn ?? [];
          return skip.includes(lead.id) ? null : lead;
        }),
      },
    };
    const ollama = { generateVariants: jest.fn(async () => [{ body: 'Olá, vi a padaria.' }]) };
    const service = new SdrRuntimeService(prisma as never, ollama as never, { judge } as never);
    return { service, ollama };
  }

  it('asks the model to write only after Jev qualifies the lead', async () => {
    const { service, ollama } = harness(jest.fn(async () => ({ answers: qualifiedAnswers() })));
    const first = await service.run('org-1');
    expect(first.decision?.qualification).toBe('QUALIFIED');
    expect(first.message.body).toBe('Olá, vi a padaria.');
    expect(ollama.generateVariants).toHaveBeenCalledTimes(1);
    expect(first.autonomy.autonomousSending).toBe(false);
    expect(JSON.stringify(first)).not.toContain('Oficina Alfa');
  });

  it('does not call the writer when Jev rejects the lead', async () => {
    const { service, ollama } = harness(
      jest.fn(async () => {
        throw new Error('jev unavailable');
      }),
    );
    const first = await service.run('org-1');
    expect(first.decision?.qualification).toBe('REJECTED');
    expect(first.message.body).toBeNull();
    expect(first.review[0]?.reason).toBe('jev_unavailable');
    expect(ollama.generateVariants).not.toHaveBeenCalled();
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
    const service = new SdrRuntimeService(prisma as never, { generateVariants: jest.fn() } as never, {
      judge: jest.fn(),
    } as never);
    const view = await service.get('org-1');
    expect(view.prospects).toEqual([]);
  });
});
