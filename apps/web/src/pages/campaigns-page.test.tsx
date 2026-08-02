import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';

import { renderWithProviders } from '@/test/render';
import { CampaignsPage } from './campaigns-page';
import { CampaignDetailPage } from './campaign-detail-page';

const mocks = vi.hoisted(() => ({
  useCampaigns: vi.fn(),
  useCreateCampaign: vi.fn(),
  useCampaign: vi.fn(),
  useCampaignMetrics: vi.fn(),
  useCampaignLeads: vi.fn(),
  useMessageTemplates: vi.fn(),
  useTemplateVariables: vi.fn(),
  useUpdateCampaignStatus: vi.fn(),
  useAddCampaignLeads: vi.fn(),
  useRemoveCampaignLead: vi.fn(),
  useCreateStageTasks: vi.fn(),
  useRecordCampaignLeadResult: vi.fn(),
  useCreateMessageTemplate: vi.fn(),
  usePreviewMessageTemplate: vi.fn(),
  useLeads: vi.fn(),
  sendCampaignMessage: vi.fn(),
}));

vi.mock('@/features/campaigns/hooks', () => ({
  useCampaigns: (...args: unknown[]) => mocks.useCampaigns(...args),
  useCreateCampaign: (...args: unknown[]) => mocks.useCreateCampaign(...args),
  useCampaign: (...args: unknown[]) => mocks.useCampaign(...args),
  useCampaignMetrics: (...args: unknown[]) => mocks.useCampaignMetrics(...args),
  useCampaignLeads: (...args: unknown[]) => mocks.useCampaignLeads(...args),
  useMessageTemplates: (...args: unknown[]) => mocks.useMessageTemplates(...args),
  useTemplateVariables: (...args: unknown[]) => mocks.useTemplateVariables(...args),
  useUpdateCampaignStatus: (...args: unknown[]) => mocks.useUpdateCampaignStatus(...args),
  useAddCampaignLeads: (...args: unknown[]) => mocks.useAddCampaignLeads(...args),
  useRemoveCampaignLead: (...args: unknown[]) => mocks.useRemoveCampaignLead(...args),
  useCreateStageTasks: (...args: unknown[]) => mocks.useCreateStageTasks(...args),
  useRecordCampaignLeadResult: (...args: unknown[]) => mocks.useRecordCampaignLeadResult(...args),
  useCreateMessageTemplate: (...args: unknown[]) => mocks.useCreateMessageTemplate(...args),
  usePreviewMessageTemplate: (...args: unknown[]) => mocks.usePreviewMessageTemplate(...args),
}));

vi.mock('@/features/leads/hooks', () => ({
  useLeads: (...args: unknown[]) => mocks.useLeads(...args),
}));

const stageId = '11111111-1111-4111-8111-111111111111';

describe('CampaignsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useCreateCampaign.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ id: 'c1', name: 'Outbound' }),
      isPending: false,
    });
  });

  it('renders empty state', () => {
    mocks.useCampaigns.mockReturnValue({
      data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderWithProviders(<CampaignsPage />, { withGoogle: false });
    expect(screen.getByText('Nenhuma campanha ainda')).toBeInTheDocument();
  });

  it('lists campaigns with keyboard-accessible links', async () => {
    mocks.useCampaigns.mockReturnValue({
      data: {
        data: [
          {
            id: 'c1',
            name: 'Padarias LX',
            status: 'DRAFT',
            segment: 'padarias',
            updatedAt: '2026-08-01T00:00:00.000Z',
            owner: { id: 'u1', name: 'Ana' },
            _count: { leads: 3 },
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderWithProviders(<CampaignsPage />, { withGoogle: false });
    const link = screen.getByRole('link', { name: 'Padarias LX' });
    expect(link).toHaveAttribute('href', '/campaigns/c1');
    link.focus();
    expect(link).toHaveFocus();
  });

  it('creates a campaign from the modal', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ id: 'c1', name: 'Nova' });
    mocks.useCampaigns.mockReturnValue({
      data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mocks.useCreateCampaign.mockReturnValue({ mutateAsync, isPending: false });
    renderWithProviders(<CampaignsPage />, { withGoogle: false });

    await user.click(screen.getAllByRole('button', { name: 'Nova campanha' })[0]!);
    await user.type(screen.getByLabelText('Nome'), 'Nova');
    await user.click(screen.getByRole('button', { name: 'Criar campanha' }));

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Nova', channel: 'ASSISTED' }),
    );
    expect(mocks.sendCampaignMessage).not.toHaveBeenCalled();
  });
});

describe('CampaignDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useUpdateCampaignStatus.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mocks.useAddCampaignLeads.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mocks.useRemoveCampaignLead.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mocks.useCreateStageTasks.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ tasksCreated: 1, tasksSkipped: 0, autoSend: false }),
      isPending: false,
    });
    mocks.useRecordCampaignLeadResult.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ messageSent: false, autoSendEnabled: false }),
      isPending: false,
    });
    mocks.useCreateMessageTemplate.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mocks.usePreviewMessageTemplate.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        body: 'Olá Acme',
        missing: [],
        unknown: [],
        allowedVariables: [],
        autoSend: false,
        messageSent: false,
        note: 'preview',
      }),
      isPending: false,
    });
    mocks.useMessageTemplates.mockReturnValue({
      data: {
        data: [{ id: 't1', name: 'Abertura', category: 'EMAIL', body: 'Olá {{companyName}}' }],
      },
      isLoading: false,
    });
    mocks.useTemplateVariables.mockReturnValue({ data: ['companyName', 'email'] });
    mocks.useLeads.mockReturnValue({
      data: {
        data: [
          {
            id: 'lead-ok',
            companyName: 'Acme',
            email: 'a@acme.test',
            phone: '11999999999',
            city: 'SP',
            score: 80,
            doNotContact: false,
            status: 'NEW',
          },
          {
            id: 'lead-dnc',
            companyName: 'Blocked Co',
            email: 'b@blocked.test',
            phone: null,
            city: 'SP',
            score: 10,
            doNotContact: true,
            status: 'NEW',
          },
        ],
        meta: { page: 1, pageSize: 10, total: 2, totalPages: 1 },
      },
      isLoading: false,
    });
    mocks.useCampaign.mockReturnValue({
      data: {
        id: 'c1',
        name: 'Padarias LX',
        status: 'DRAFT',
        segment: 'padarias',
        updatedAt: '2026-08-01T00:00:00.000Z',
        assistedOnly: true,
        autoSendEnabled: false,
        metrics: {
          stages: [{ id: stageId, type: 'EMAIL_MANUAL', name: 'E-mail manual', order: 1 }],
        },
        _count: { leads: 1 },
      },
      isLoading: false,
      isError: false,
    });
    mocks.useCampaignMetrics.mockReturnValue({
      data: {
        totals: {
          leads: 1,
          pending: 1,
          openTasks: 0,
          contacted: 0,
          replied: 0,
          interested: 0,
          meeting: 0,
          proposal: 0,
          won: 0,
          lost: 0,
          noResponse: 0,
          optOut: 0,
        },
        eventsRecorded: 0,
        stages: [
          {
            id: stageId,
            type: 'EMAIL_MANUAL',
            name: 'E-mail manual',
            order: 1,
            leadCount: 1,
            openTasks: 0,
          },
        ],
        autoSendEnabled: false,
      },
      isLoading: false,
    });
    mocks.useCampaignLeads.mockReturnValue({
      data: {
        data: [
          {
            campaignId: 'c1',
            leadId: 'lead-ok',
            status: 'PENDING',
            lead: {
              id: 'lead-ok',
              companyName: 'Acme',
              email: 'a@acme.test',
              phone: '11999999999',
              city: 'SP',
              score: 80,
              doNotContact: false,
              status: 'NEW',
            },
          },
        ],
      },
      isLoading: false,
    });
  });

  function renderDetail() {
    return renderWithProviders(
      <Routes>
        <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
      </Routes>,
      { initialEntries: ['/campaigns/c1'], withGoogle: false },
    );
  }

  it('opens detail with assisted notice and real zero-event metrics', () => {
    renderDetail();
    expect(screen.getByRole('heading', { name: 'Padarias LX' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/não envia/i);
    expect(screen.getByText(/0 eventos registrados/i)).toBeInTheDocument();
  });

  it('creates stage tasks without calling any send function', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({
      tasksCreated: 1,
      tasksSkipped: 0,
      autoSend: false,
    });
    mocks.useCreateStageTasks.mockReturnValue({ mutateAsync, isPending: false });
    renderDetail();

    await user.click(screen.getByRole('button', { name: 'Criar tarefas' }));
    expect(mutateAsync).toHaveBeenCalledWith({ stageId });
    expect(mocks.sendCampaignMessage).not.toHaveBeenCalled();
  });

  it('blocks do-not-contact leads in the picker', async () => {
    const user = userEvent.setup();
    renderDetail();
    await user.click(screen.getByRole('button', { name: 'Adicionar leads' }));
    expect(screen.getByText('Blocked Co')).toBeInTheDocument();
    expect(screen.getByText(/Opt-out \/ não contactar/i)).toBeInTheDocument();
    const dncCheckbox = screen.getByText('Blocked Co').closest('label')?.querySelector('input');
    expect(dncCheckbox).toBeDisabled();
  });

  it('records a manual result without sending', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ messageSent: false, autoSendEnabled: false });
    mocks.useRecordCampaignLeadResult.mockReturnValue({ mutateAsync, isPending: false });
    renderDetail();

    await user.click(screen.getByRole('button', { name: 'Ação manual' }));
    await user.click(screen.getByRole('button', { name: 'Registrar resultado' }));

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: 'lead-ok', result: 'CONTACTED' }),
    );
    expect(mocks.sendCampaignMessage).not.toHaveBeenCalled();
  });

  it('previews templates in assisted mode only', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({
      body: 'Olá Acme',
      autoSend: false,
      messageSent: false,
      missing: [],
      unknown: [],
      allowedVariables: [],
      note: 'preview',
    });
    mocks.usePreviewMessageTemplate.mockReturnValue({ mutateAsync, isPending: false });
    renderDetail();

    await user.click(screen.getByRole('button', { name: 'Ação manual' }));
    await user.click(screen.getByRole('button', { name: /Preview: Abertura/i }));

    expect(mutateAsync).toHaveBeenCalled();
    expect(await screen.findByText(/Preview assistido/i)).toBeInTheDocument();
    expect(mocks.sendCampaignMessage).not.toHaveBeenCalled();
  });
});
