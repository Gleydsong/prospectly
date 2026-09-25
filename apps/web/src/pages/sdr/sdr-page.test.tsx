import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';

import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { EMPTY_SDR_WORKSPACE, SdrWorkspace, type SdrWorkspaceView } from './sdr-page';

const populated: SdrWorkspaceView = {
  campaign: { name: 'Oficinas locais', status: 'ACTIVE' },
  autonomy: {
    autonomousSending: false,
    autonomousFollowup: false,
    autonomousReply: false,
  },
  prospects: [{ id: 'prospect-1', name: 'Oficina Alfa', score: 56, state: 'CONTACTED' }],
  evidence: [{ id: 'ev-ssl', field: 'ssl', value: 'absent' }],
  decision: { qualification: 'QUALIFIED', traceId: 'trace-1' },
  message: { status: 'BLOCK', body: null },
  review: [{ prospectId: 'prospect-1', reason: 'outside_working_hours' }],
  metrics: { blocked: 1 },
};

describe('SdrWorkspace', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('pt');
  });

  it('shows autonomous sending off and no message body by default', () => {
    renderWithProviders(<SdrWorkspace initial={EMPTY_SDR_WORKSPACE} />, { withGoogle: false });

    expect(screen.getByText('Envio autônomo desligado')).toBeInTheDocument();
    expect(screen.getByText('BLOCK')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument();
  });

  it('shows the prospect score, evidence, and records a local approval', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SdrWorkspace initial={populated} />, { withGoogle: false });

    expect(screen.getByText('Oficina Alfa · CONTACTED · 56')).toBeInTheDocument();
    expect(screen.getByText('ssl: absent')).toBeInTheDocument();
    expect(screen.getByText('QUALIFIED · trace-1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Aprovar' }));
    expect(screen.getByText('Aprovado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument();
  });
});
