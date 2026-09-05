import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { SeoAudit, SeoFinding } from '@/types';

import { SeoAuditSection } from './seo-audit-section';

function finding(code: string, points: number, quickWin: boolean, severity: SeoFinding['severity']): SeoFinding {
  return {
    code,
    vector: 'ON_PAGE',
    severity,
    points,
    quickWin,
    title: `Título ${code}`,
    diagnosis: `Diagnóstico ${code}`,
    impact: `Impacto ${code}`,
    fix: `Correção ${code}`,
  };
}

const findings = [
  finding('SEO_CSR_SHELL', 18, false, 'HIGH'),
  finding('SEO_NO_TITLE', 8, true, 'HIGH'),
  finding('SEO_NO_H1', 6, true, 'MEDIUM'),
  finding('SEO_NO_CANONICAL', 3, true, 'LOW'),
];

const audit: SeoAudit = {
  healthScore: 38,
  opportunity: 'CRITICAL',
  architecture: 'React SPA (CSR)',
  vectors: {
    INDEXABILITY: { score: 12, max: 30 },
    ON_PAGE: { score: 10, max: 30 },
    PERFORMANCE: { score: 8, max: 20 },
    LOCAL_INFRA: { score: 8, max: 20 },
  },
  findings,
  topIssues: findings.slice(0, 3),
  quickWins: findings.filter((f) => f.quickWin).slice(0, 2),
  signals: {
    renderingMode: 'CSR',
    visibleTextLength: 20,
    noindex: false,
    h1Count: 0,
    jsonLdTypes: [],
    hasMicrodata: false,
    images: { total: 0, missingDimensions: 0, modernFormat: 0, missingAlt: 0 },
    thirdPartyScriptHosts: [],
    renderBlockingScripts: 0,
    hasAddress: false,
  },
};

describe('SeoAuditSection', () => {
  it('renders the scorecard with health score, opportunity and architecture', () => {
    render(<SeoAuditSection audit={audit} />);
    expect(screen.getByRole('img', { name: 'SEO Health Score 38 de 100' })).toBeInTheDocument();
    expect(screen.getByText('Oportunidade crítica')).toBeInTheDocument();
    expect(screen.getByText('Arquitetura: React SPA (CSR)')).toBeInTheDocument();
    expect(screen.getByText('12/30')).toBeInTheDocument();
  });

  it('lists the top issues and reveals diagnosis, impact and fix on demand', () => {
    render(<SeoAuditSection audit={audit} />);
    expect(screen.getByText('Título SEO_CSR_SHELL')).toBeInTheDocument();
    expect(screen.queryByText('Título SEO_NO_CANONICAL')).not.toBeInTheDocument();
    expect(screen.queryByText('Diagnóstico SEO_CSR_SHELL')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Título SEO_CSR_SHELL/ }));
    expect(screen.getByText('Diagnóstico SEO_CSR_SHELL')).toBeInTheDocument();
    expect(screen.getByText('Impacto SEO_CSR_SHELL')).toBeInTheDocument();
    expect(screen.getByText('Correção SEO_CSR_SHELL')).toBeInTheDocument();
  });

  it('renders at most two quick wins', () => {
    render(<SeoAuditSection audit={audit} />);
    expect(screen.getByText('Quick wins (menos de 1h)')).toBeInTheDocument();
    expect(screen.getByText('Título SEO_NO_TITLE:')).toBeInTheDocument();
    expect(screen.getByText('Título SEO_NO_H1:')).toBeInTheDocument();
    expect(screen.queryByText('Título SEO_NO_CANONICAL:')).not.toBeInTheDocument();
  });
});
