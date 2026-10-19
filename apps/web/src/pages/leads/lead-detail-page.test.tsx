import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { useAuthStore } from '@/stores/auth.store';
import { Role } from '@/types';

import { LeadDetailPage } from './lead-detail-page';

const mocks = vi.hoisted(() => ({
  moveLeadToStage: vi.fn(),
  fetchPipelines: vi.fn(),
  useLead: vi.fn(),
  createActivity: vi.fn(),
  updateTask: vi.fn(),
  fetchTasks: vi.fn(),
  useCustomFields: vi.fn(),
  updateLead: vi.fn(),
  analyzeWebsite: vi.fn(),
}));

vi.mock('@/features/leads/hooks', () => ({
  useLead: (...args: unknown[]) => mocks.useLead(...args),
  useLeadActivities: () => ({ data: { data: [] }, isLoading: false }),
  useCreateActivity: () => ({ mutateAsync: mocks.createActivity, isPending: false }),
  useUpdateLead: () => ({ mutateAsync: mocks.updateLead, isPending: false }),
  useAddLeadTags: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveLeadTag: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/features/communications/hooks', () => ({
  useSyncedCommunications: () => ({ data: { data: [] }, isLoading: false }),
}));

vi.mock('@/features/custom-fields/hooks', () => ({
  useCustomFields: () => mocks.useCustomFields(),
}));

vi.mock('@/features/tasks/api', () => ({
  fetchTasks: (...args: unknown[]) => mocks.fetchTasks(...args),
}));

vi.mock('@/features/tasks/hooks', () => ({
  useCreateTaskForLead: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTask: () => ({ mutateAsync: mocks.updateTask, isPending: false }),
}));

vi.mock('@/features/scoring/api', () => ({
  requestLeadWebsiteAnalysis: (...args: unknown[]) => mocks.analyzeWebsite(...args),
}));

vi.mock('@/features/agents/hooks', () => ({
  useCrmSuggest: () => ({ data: null, isLoading: false, isError: false }),
  useCrmApply: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useWhatsappVariants: () => ({
    data: { variants: [], digits: '5511999887766' },
    isLoading: false,
    isError: false,
  }),
  useWhatsappRecordOutreach: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/features/pipeline/api', () => ({
  fetchPipelines: (...args: unknown[]) => mocks.fetchPipelines(...args),
  moveLeadToStage: (...args: unknown[]) => mocks.moveLeadToStage(...args),
}));

vi.mock('@/features/leads/components/lead-websites-card', () => ({
  LeadWebsitesCard: () => <div>Sites do lead</div>,
}));

const TEXT_FIELD = {
  id: 'field-nif',
  name: 'NIF',
  type: 'text' as const,
  position: 0,
  archivedAt: null,
  options: [],
};

const ARCHIVED_FIELD = {
  id: 'field-old',
  name: 'Código antigo',
  type: 'text' as const,
  position: 1,
  archivedAt: '2026-09-01T00:00:00.000Z',
  options: [],
};

function setUser(role: Role) {
  useAuthStore.setState({
    user: {
      id: 'u1',
      email: 'a@b.com',
      name: 'Ana',
      role,
      emailVerifiedAt: '2026-01-01T00:00:00.000Z',
      organizationId: 'org1',
      organizationName: 'Acme',
      locale: 'pt',
      defaultPersona: 'vendedor',
      personaOverride: null,
      effectivePersona: 'vendedor',
      personaOnboardedAt: '2026-01-01T00:00:00.000Z',
    },
    accessToken: 'token',
    bootstrapped: true,
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/leads/lead-1']}>
        <Link to="/leads/lead-2">Outro cliente</Link>
        <Routes>
          <Route path="/leads/:id" element={<LeadDetailPage />} />
          <Route path="/pipeline" element={<p>Página do funil</p>} />
          <Route path="/agents/crm" element={<p>Assistente CRM</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const baseLead = {
  id: 'lead-1',
  companyName: 'Medic Saúde',
  category: 'clinic',
  city: 'Mata Grande',
  country: 'BR',
  phone: '+5511999887766',
  address: 'Rua das Flores, 10',
  state: 'AL',
  status: 'TO_REVIEW',
  source: 'GOOGLE_PLACES',
  score: 35,
  doNotContact: false,
  stage: null,
  tags: [],
  contacts: [],
  website: null,
  email: null,
  notes: null,
  customFieldValues: {} as Record<string, string | number | null>,
  createdAt: '2026-08-15T01:00:00.000Z',
  updatedAt: '2026-08-15T01:00:00.000Z',
};

describe('LeadDetailPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt');
    vi.clearAllMocks();
    setUser(Role.MEMBER);
    mocks.useCustomFields.mockReturnValue({ data: [], isLoading: false });
    mocks.updateLead.mockResolvedValue({});
    mocks.useLead.mockReturnValue({
      data: baseLead,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mocks.fetchPipelines.mockResolvedValue([
      {
        id: 'pipeline-1',
        name: 'Funil padrão',
        isDefault: true,
        stages: [
          { id: 'stage-review', name: 'Em análise', order: 1 },
          { id: 'stage-new', name: 'Novos', order: 0 },
        ],
      },
    ]);
    mocks.moveLeadToStage.mockResolvedValue(undefined);
    mocks.fetchTasks.mockResolvedValue({
      data: [{ id: 'task-1', title: 'Retornar ligação', status: 'OPEN', priority: 'MEDIUM' }],
      meta: { page: 1, totalPages: 1, total: 1 },
    });
    mocks.updateTask.mockResolvedValue({ id: 'task-1', status: 'DONE' });
    mocks.createActivity.mockResolvedValue({ id: 'act-1' });
  });

  it('avança o cliente no funil com um clique na etapa', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Funil do cliente'));
    await user.click(await screen.findByRole('button', { name: 'Novos' }, { timeout: 5000 }));

    await waitFor(() => {
      expect(mocks.moveLeadToStage).toHaveBeenCalledWith('lead-1', 'stage-new');
    });
    expect(await screen.findByText('Cliente movido para a etapa “Novos” do funil.')).toBeVisible();
  });

  it('abre o funil quando o cliente já possui uma etapa', async () => {
    const current = mocks.useLead();
    mocks.useLead.mockReturnValue({
      ...current,
      data: { ...current.data, stage: { id: 'stage-new', name: 'Novos' } },
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Funil do cliente'));
    await user.click(screen.getByRole('button', { name: 'Ver no funil' }));

    expect(await screen.findByText('Página do funil')).toBeVisible();
    expect(mocks.moveLeadToStage).not.toHaveBeenCalled();
  });

  it('não mostra o card vazio de análise do site e oferece busca no Google', async () => {
    renderPage();

    expect(await screen.findByRole('link', { name: 'Buscar no Google' })).toHaveAttribute(
      'href',
      'https://www.google.com/search?q=Medic%20Sa%C3%BAde%20Mata%20Grande',
    );
    expect(screen.getByRole('button', { name: 'Inserir URL' })).toBeInTheDocument();
    expect(screen.queryByText('Análise do site')).not.toBeInTheDocument();
    expect(screen.queryByText('Sem site cadastrado')).not.toBeInTheDocument();
    expect(screen.getByText(/oportunidade de presença online/i)).toBeInTheDocument();
  });

  it('exibe notas persistidas em seu próprio card sem auditoria técnica nas informações', () => {
    mocks.useLead.mockReturnValue({
      data: {
        ...baseLead,
        notes: 'Importado do Google Places. Validação manual de website necessária.',
      },
      isLoading: false,
    });
    renderPage();

    expect(screen.queryByText('Origem & Auditoria Técnica')).not.toBeInTheDocument();
    expect(screen.queryByText('Observações')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Notas')).toHaveValue(
      'Importado do Google Places. Validação manual de website necessária.',
    );
  });

  it('conclui tarefa no checkbox e registra na timeline', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole('checkbox', { name: 'Concluir tarefa Retornar ligação' }),
    );

    await waitFor(() => {
      expect(mocks.updateTask).toHaveBeenCalledWith({ id: 'task-1', status: 'DONE' });
    });
    expect(mocks.createActivity).toHaveBeenCalledWith({
      type: 'TASK',
      description: 'Tarefa concluída: Retornar ligação',
    });
  });

  it('lets MEMBER save custom field values on the record', async () => {
    mocks.useCustomFields.mockReturnValue({ data: [TEXT_FIELD], isLoading: false });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('NIF'), '123');
    await user.click(screen.getByRole('button', { name: 'Guardar campos' }));

    await waitFor(() => {
      expect(mocks.updateLead).toHaveBeenCalledWith({
        customFieldValues: { 'field-nif': '123' },
      });
    });
  });

  it('lets VIEWER read values without save controls', () => {
    setUser(Role.VIEWER);
    mocks.useCustomFields.mockReturnValue({ data: [TEXT_FIELD], isLoading: false });
    mocks.useLead.mockReturnValue({
      ...mocks.useLead(),
      data: { ...mocks.useLead().data, customFieldValues: { 'field-nif': 'PT123' } },
    });
    renderPage();

    expect(screen.getByText(/PT123/)).toBeVisible();
    expect(screen.queryByLabelText('NIF')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar campos' })).not.toBeInTheDocument();
  });

  it('keeps archived field values read-only on the record', () => {
    mocks.useCustomFields.mockReturnValue({
      data: [TEXT_FIELD, ARCHIVED_FIELD],
      isLoading: false,
    });
    mocks.useLead.mockReturnValue({
      ...mocks.useLead(),
      data: {
        ...mocks.useLead().data,
        customFieldValues: { 'field-old': 'LEGACY' },
      },
    });
    renderPage();

    expect(screen.getByText(/Código antigo: LEGACY/)).toBeVisible();
    expect(screen.getByText(/arquivado/i)).toBeVisible();
    expect(screen.queryByLabelText('Código antigo')).not.toBeInTheDocument();
    expect(screen.getByLabelText('NIF')).toBeInTheDocument();
  });

  it('abre o modal de abordagem de WhatsApp ao clicar em Chamar no WhatsApp', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /chamar no whatsapp/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /chamar no whatsapp/i })).toBeInTheDocument();
  });
  it.each([{ doNotContact: true }, { suppressed: true }])(
    'bloqueia WhatsApp no cabeçalho e nos canais: %j',
    async (flags) => {
      mocks.useLead.mockReturnValue({ ...mocks.useLead(), data: { ...baseLead, ...flags } });
      renderPage();
      expect(screen.getByRole('button', { name: 'Chamar no WhatsApp' })).toBeDisabled();
      expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    },
  );

  it('salva LeadStatus pelo stepper e notas pela integração existente', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Respondeu' }));
    expect(mocks.updateLead).toHaveBeenCalledWith({ status: 'RESPONDED' });
    await user.type(screen.getByLabelText('Notas'), 'Retornar amanhã');
    await user.click(screen.getByRole('button', { name: 'Salvar notas' }));
    expect(mocks.updateLead).toHaveBeenCalledWith({ notes: 'Retornar amanhã' });
  });

  it('separa a saúde do site da oportunidade e agrupa problemas reais', async () => {
    mocks.useLead.mockReturnValue({
      ...mocks.useLead(),
      data: {
        ...baseLead,
        score: 92,
        website: 'https://example.com',
        websiteRecord: {
          analyses: [
            {
              id: 'a1',
              status: 'COMPLETED',
              seoHealthScore: 32,
              issues: [
                { id: 'i1', code: 'NO_HTTPS', severity: 'CRITICAL', message: 'No HTTPS' },
                { id: 'i2', code: 'NO_CONTACT_FORM', severity: 'INFO', message: 'No form' },
              ],
            },
          ],
        },
      },
    });
    const user = userEvent.setup();
    mocks.analyzeWebsite.mockResolvedValue({});
    renderPage();
    expect(screen.getByRole('meter', { name: 'Saúde do site' })).toHaveAttribute(
      'aria-valuenow',
      '32',
    );
    expect(screen.getByText('Score de oportunidade')).toBeVisible();
    expect(screen.getByText('Segurança e acesso')).toBeVisible();
    expect(screen.getByText('Experiência e contato')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Reanalisar site' }));
    expect(mocks.analyzeWebsite).toHaveBeenCalledWith('lead-1');
  });
  it('não leva notas em edição para outro cliente ao navegar', async () => {
    mocks.useLead.mockImplementation((id) => ({
      data: { ...baseLead, id, notes: id === 'lead-2' ? 'Nota do segundo cliente' : '' },
      isLoading: false,
      refetch: vi.fn(),
    }));
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Notas'), 'Rascunho do primeiro');
    await user.click(screen.getByRole('link', { name: 'Outro cliente' }));
    expect(screen.getByLabelText('Notas')).toHaveValue('Nota do segundo cliente');
    expect(screen.getByRole('button', { name: 'Salvar notas' })).toBeDisabled();
  });

  it('traduz ficha e controles de histórico para inglês', async () => {
    await i18n.changeLanguage('en');
    renderPage();
    expect(screen.getByRole('heading', { name: 'Customer file' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Contact on WhatsApp' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Recent history' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Record' })).toHaveClass('border');
    expect(screen.getByLabelText('Notes')).toBeVisible();
  });
});
