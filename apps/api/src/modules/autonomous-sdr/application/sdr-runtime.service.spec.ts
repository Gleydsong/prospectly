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

describe('SdrRuntimeService', () => {
  it('advances one real lead per click and then stops', async () => {
    let stored: SdrRuntimeView | null = null;
    const prisma = {
      sdrRuntime: {
        findUnique: jest.fn(async () => (stored ? { view: stored } : null)),
        upsert: jest.fn(async ({ create, update }: { create: { view: SdrRuntimeView }; update: { view: SdrRuntimeView } }) => {
          stored = update?.view ?? create.view;
        }),
      },
      lead: {
        findFirst: jest.fn(async ({ where }: { where: { id?: { notIn: string[] } } }) => {
          const skip = where.id?.notIn ?? [];
          return skip.includes(lead.id) ? null : lead;
        }),
      },
    };
    const ollama = {
      generateVariants: jest.fn(async () => [{ body: 'Olá, vi a padaria.' }]),
    };
    const service = new SdrRuntimeService(prisma as never, ollama as never);

    const first = await service.run('org-1');
    expect(first.prospects).toEqual([
      expect.objectContaining({ id: 'lead-1', name: 'Padaria do Centro', score: 60 }),
    ]);
    expect(first.message).toEqual({ status: 'BLOCK', body: 'Olá, vi a padaria.' });
    expect(JSON.stringify(first)).not.toContain('Oficina Alfa');
    expect(first.autonomy.autonomousSending).toBe(false);

    const second = await service.run('org-1');
    expect(second.prospects).toEqual([]);
    expect(second.seenLeadIds).toEqual(['lead-1']);
  });

  it('drops a saved local fixture', async () => {
    const prisma = {
      sdrRuntime: {
        findUnique: jest.fn(async () => ({
          view: {
            campaign: { name: 'Oficinas locais', status: 'ACTIVE' },
            autonomy: { autonomousSending: false, autonomousFollowup: false, autonomousReply: false },
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
    const service = new SdrRuntimeService(prisma as never, { generateVariants: jest.fn() } as never);
    const view = await service.get('org-1');
    expect(view.prospects).toEqual([]);
  });
});
