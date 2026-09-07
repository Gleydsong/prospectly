import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';
import { Role } from '@/types';

import { CustomFieldsPage } from './custom-fields-page';

const mocks = vi.hoisted(() => ({
  useCustomFields: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
  unarchive: vi.fn(),
  reorder: vi.fn(),
}));

vi.mock('@/features/custom-fields/hooks', () => ({
  useCustomFields: () => mocks.useCustomFields(),
  useCreateCustomField: () => ({ mutateAsync: mocks.create, isPending: false }),
  useUpdateCustomField: () => ({ mutateAsync: mocks.update, isPending: false }),
  useArchiveCustomField: () => ({ mutateAsync: mocks.archive, isPending: false }),
  useUnarchiveCustomField: () => ({ mutateAsync: mocks.unarchive, isPending: false }),
  useReorderCustomFields: () => ({ mutateAsync: mocks.reorder, isPending: false }),
}));

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
    },
    accessToken: 'token',
    bootstrapped: true,
  });
}

describe('CustomFieldsPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt');
    vi.clearAllMocks();
    mocks.useCustomFields.mockReturnValue({ data: [], isLoading: false });
    mocks.create.mockResolvedValue({});
    setUser(Role.OWNER);
  });

  it('lets OWNER create a text field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomFieldsPage />, {
      withGoogle: false,
      initialEntries: ['/custom-fields'],
    });

    await user.type(screen.getByLabelText('Nome'), 'NIF');
    await user.click(screen.getByRole('button', { name: 'Criar campo' }));

    expect(mocks.create).toHaveBeenCalledWith({
      name: 'NIF',
      type: 'text',
      options: undefined,
    });
  });

  it('hides schema controls from VIEWER', () => {
    setUser(Role.VIEWER);
    mocks.useCustomFields.mockReturnValue({
      data: [
        {
          id: 'field-nif',
          name: 'NIF',
          type: 'text',
          position: 0,
          archivedAt: null,
          options: [],
        },
      ],
      isLoading: false,
    });

    renderWithProviders(<CustomFieldsPage />, { withGoogle: false });

    expect(screen.queryByRole('button', { name: 'Criar campo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Arquivar' })).not.toBeInTheDocument();
    expect(screen.getByText('NIF')).toBeInTheDocument();
    expect(screen.getByText(/apenas leitura/i)).toBeInTheDocument();
  });

  it('lets OWNER add a select option', async () => {
    setUser(Role.OWNER);
    mocks.useCustomFields.mockReturnValue({
      data: [
        {
          id: 'field-seg',
          name: 'Segmento',
          type: 'select',
          position: 0,
          archivedAt: null,
          options: [{ id: 'opt-a', label: 'Clínica', archivedAt: null }],
        },
      ],
      isLoading: false,
    });
    const user = userEvent.setup();
    renderWithProviders(<CustomFieldsPage />, { withGoogle: false });

    await user.type(screen.getByLabelText('Adicionar opção'), 'Hospital');
    await user.click(screen.getByRole('button', { name: 'Adicionar opção' }));

    expect(mocks.update).toHaveBeenCalledWith({
      id: 'field-seg',
      options: [
        { id: 'opt-a', label: 'Clínica', archived: false },
        { label: 'Hospital' },
      ],
    });
  });
});
