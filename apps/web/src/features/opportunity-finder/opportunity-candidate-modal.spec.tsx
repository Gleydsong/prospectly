import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { OpportunityCandidateView } from '@/types';
import { OpportunityCandidateModal } from './opportunity-candidate-modal';

describe('OpportunityCandidateModal', () => {
  const baseCandidate: OpportunityCandidateView = {
    id: 'cand-1',
    runId: 'run-1',
    status: 'SCORED',
    company: {
      companyName: 'Padaria Modelo',
      city: 'São Paulo',
      state: 'SP',
      country: 'BR',
      websitePresence: 'NO_WEBSITE_REPORTED',
    },
    signals: [],
    scoreBreakdown: { dna: { need: 80, fit: 85 } },
    overallScore: 85,
    confidenceScore: 80,
    dataCompleteness: 70,
    rankingCategory: 'restaurant',
    explanation: null,
    importedLeadId: null,
    analyzedAt: '2026-08-12T10:00:00.000Z',
  };

  it('renders restricted explanation without empty labels for recommendedOffer and commercialAngle', () => {
    const candidate: OpportunityCandidateView = {
      ...baseCandidate,
      explanation: {
        summary: 'Padaria Modelo possui restrição de contato ativa.',
        whyOpportunity: 'Contato comercial bloqueado por política de não contatar ou supressão.',
        warnings: ['Empresa ou contato marcado como do-not-contact ou presente na lista de supressão.'],
        source: 'DETERMINISTIC_FALLBACK',
      },
    };

    render(
      <OpportunityCandidateModal
        candidate={candidate}
        open={true}
        onClose={vi.fn()}
        onExplain={vi.fn()}
        onSave={vi.fn()}
        explaining={false}
        saving={false}
      />,
    );

    expect(screen.getByText('Padaria Modelo possui restrição de contato ativa.')).toBeInTheDocument();
    expect(screen.getByText('Contato comercial bloqueado por política de não contatar ou supressão.')).toBeInTheDocument();
    expect(screen.queryByText(/Oferta sugerida:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Abordagem:/i)).not.toBeInTheDocument();
  });

  it('renders recommendedOffer and commercialAngle when present in explanation', () => {
    const candidate: OpportunityCandidateView = {
      ...baseCandidate,
      explanation: {
        summary: 'Padaria Modelo tem alta avaliação mas sem site.',
        whyOpportunity: 'Oportunidade de criar site.',
        recommendedOffer: 'Desenvolvimento de site com cardápio',
        commercialAngle: 'Abordar foco em pedidos diretos',
        warnings: [],
        source: 'AI',
      },
    };

    render(
      <OpportunityCandidateModal
        candidate={candidate}
        open={true}
        onClose={vi.fn()}
        onExplain={vi.fn()}
        onSave={vi.fn()}
        explaining={false}
        saving={false}
      />,
    );

    expect(screen.getByText('Desenvolvimento de site com cardápio')).toBeInTheDocument();
    expect(screen.getByText('Abordar foco em pedidos diretos')).toBeInTheDocument();
    expect(screen.getByText(/Oferta sugerida:/i)).toBeInTheDocument();
    expect(screen.getByText(/Abordagem:/i)).toBeInTheDocument();
  });
});
