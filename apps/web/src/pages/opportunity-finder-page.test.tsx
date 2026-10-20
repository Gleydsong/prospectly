import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import type { OpportunityCandidateView, OpportunityRunView } from '@/types';
import { OpportunityFinderPage } from './opportunity-finder-page';

const mocks = vi.hoisted(() => ({
  createRun: vi.fn(),
  explainCandidate: vi.fn(),
  saveCandidate: vi.fn(),
  useRun: vi.fn(),
  useCandidates: vi.fn(),
}));

vi.mock('@/features/opportunity-finder/hooks', () => ({
  useCreateOpportunityRun: () => ({ mutateAsync: mocks.createRun, isPending: false }),
  useExplainOpportunityCandidate: () => ({ mutateAsync: mocks.explainCandidate, isPending: false }),
  useSaveOpportunityAsLead: () => ({ mutateAsync: mocks.saveCandidate, isPending: false }),
  useOpportunityRun: (...args: unknown[]) => mocks.useRun(...args),
  useOpportunityCandidates: (...args: unknown[]) => mocks.useCandidates(...args),
}));

vi.mock('@/features/prospecting/hooks', () => ({
  useGeoRegions: () => ({ data: [{ code: 'SP', name: 'São Paulo' }], isLoading: false }),
  useGeoCities: (_country: string, region?: string) => ({
    data: region ? [{ name: 'Campinas' }] : [],
    isLoading: false,
  }),
}));

const completedRun: OpportunityRunView = {
  id: 'run-1',
  status: 'COMPLETED',
  service: 'Criação de sites',
  city: 'Campinas',
  state: 'SP',
  country: 'BR',
  scoringVersion: 'opportunity-score-v1',
  candidateCount: 4,
  analyzedCount: 4,
  failedCount: 0,
  startedAt: '2026-10-20T10:00:00.000Z',
  createdAt: '2026-10-20T10:00:00.000Z',
};

function candidate(
  id: string,
  rankingCategory: OpportunityCandidateView['rankingCategory'],
): OpportunityCandidateView {
  return {
    id,
    runId: 'run-1',
    status: 'SCORED',
    company: {
      externalId: id,
      companyName: `Empresa ${rankingCategory}`,
      city: 'Campinas',
      state: 'SP',
      country: 'BR',
      source: 'OPENSTREETMAP',
      websitePresence: 'NO_WEBSITE_REPORTED',
    },
    signals: [],
    scoreBreakdown: {
      version: 'opportunity-score-v1',
      dna: { need: 10, quality: 10, reach: 10, timing: 10, fit: 10 },
      reasons: [],
    },
    overallScore: 80,
    confidenceScore: 75,
    dataCompleteness: 60,
    rankingCategory,
  };
}

const candidates = [
  candidate('candidate-excellent', 'EXCELLENT'),
  candidate('candidate-high', 'HIGH'),
  candidate('candidate-medium', 'MEDIUM'),
  candidate('candidate-low', 'LOW'),
];

async function submitSearch(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('O que você vende?'), '  criação de sites  ');
  await user.type(screen.getByLabelText('Qual nicho deseja encontrar?'), ' clínicas ');
  await user.selectOptions(screen.getByLabelText('Estado'), 'SP');
  await user.selectOptions(screen.getByLabelText('Cidade'), 'Campinas');
  await user.click(screen.getByRole('button', { name: 'Buscar empresas' }));
}

describe('OpportunityFinderPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('request-key');
    mocks.useRun.mockImplementation((runId: string) => ({
      data: runId ? completedRun : undefined,
    }));
    mocks.useCandidates.mockImplementation((runId: string) => ({
      data: runId ? { data: candidates, total: candidates.length } : undefined,
      isLoading: false,
      isError: false,
    }));
  });

  it('submits service, niche, state and city to create an opportunity run', async () => {
    const user = userEvent.setup();
    mocks.createRun.mockResolvedValue({ id: 'run-1' });
    renderWithProviders(<OpportunityFinderPage embedded />);

    await submitSearch(user);

    expect(mocks.createRun).toHaveBeenCalledWith({
      service: 'criação de sites',
      niche: 'clínicas',
      city: 'Campinas',
      state: 'SP',
      country: 'BR',
      idempotencyKey: 'request-key',
    });
  });

  it('shows a safe error when run creation fails', async () => {
    const user = userEvent.setup();
    mocks.createRun.mockRejectedValue(new Error('offline'));
    renderWithProviders(<OpportunityFinderPage embedded />);

    await submitSearch(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Ocorreu um erro inesperado.');
    expect(screen.queryByText('Análise concluída')).not.toBeInTheDocument();
  });

  it('keeps one primary CTA and marks the active ranking filter accessibly', async () => {
    const user = userEvent.setup();
    mocks.createRun.mockResolvedValue({ id: 'run-1' });
    renderWithProviders(<OpportunityFinderPage embedded />);

    await submitSearch(user);
    await screen.findByText('4 oportunidades priorizadas');

    expect(document.querySelectorAll('button.cta-primary')).toHaveLength(1);
    const allFilter = screen.getByRole('button', { name: 'Todas (4)' });
    const highFilter = screen.getByRole('button', { name: 'Altas (1)' });
    expect(allFilter).toHaveAttribute('aria-pressed', 'true');
    expect(highFilter).toHaveAttribute('aria-pressed', 'false');

    await user.click(highFilter);

    expect(allFilter).toHaveAttribute('aria-pressed', 'false');
    expect(highFilter).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Empresa HIGH')).toBeInTheDocument();
    expect(screen.queryByText('Empresa EXCELLENT')).not.toBeInTheDocument();
    expect(document.querySelectorAll('button.cta-primary')).toHaveLength(1);
    for (const filter of screen.getAllByRole('button', {
      name: /^(Todas|Excelentes|Altas|Médias|Baixas)/,
    })) {
      expect(filter).not.toHaveClass('cta-primary');
    }
  });

  it('explains and saves the selected candidate through their existing mutation seams', async () => {
    const user = userEvent.setup();
    const selectedCandidate = candidates[1]!;
    mocks.createRun.mockResolvedValue({ id: 'run-1' });
    mocks.explainCandidate.mockResolvedValue({
      ...selectedCandidate,
      explanation: {
        summary: 'Resumo',
        whyOpportunity: 'Motivo',
        recommendedOffer: 'Oferta',
        commercialAngle: 'Abordagem',
        warnings: [],
        source: 'AI',
      },
    });
    mocks.saveCandidate.mockResolvedValue({ status: 'SAVED', leadId: 'lead-1' });
    renderWithProviders(<OpportunityFinderPage embedded />);

    await submitSearch(user);
    await user.click((await screen.findAllByRole('button', { name: 'Ver evidências' }))[1]!);
    await user.click(screen.getByRole('button', { name: /Gerar explicação/ }));

    await waitFor(() =>
      expect(mocks.explainCandidate).toHaveBeenCalledWith({
        runId: 'run-1',
        candidateId: 'candidate-high',
      }),
    );
    expect(await screen.findByText('Resumo')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Salvar como cliente/ }));

    expect(mocks.saveCandidate).toHaveBeenCalledWith({
      runId: 'run-1',
      candidateId: 'candidate-high',
    });
    expect(await screen.findByRole('button', { name: 'Salvo como cliente' })).toBeDisabled();
  });
});
