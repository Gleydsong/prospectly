import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';

import { OrganizationFlagsCard } from './organization-flags-card';

const mocks = vi.hoisted(() => ({
  fetchOrganizationFlags: vi.fn(),
  updateOrganizationFlag: vi.fn(),
}));

vi.mock('@/features/organization-flags/api', () => ({
  fetchOrganizationFlags: () => mocks.fetchOrganizationFlags(),
  updateOrganizationFlag: (key: string, enabled: boolean) =>
    mocks.updateOrganizationFlag(key, enabled),
}));

describe('OrganizationFlagsCard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt');
    vi.clearAllMocks();
    mocks.fetchOrganizationFlags.mockResolvedValue([{ key: 'saved_report', enabled: false }]);
    mocks.updateOrganizationFlag.mockResolvedValue({ key: 'saved_report', enabled: true });
  });

  it('lets OWNER toggle an allowlisted flag', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrganizationFlagsCard canManage emailVerified />, { withGoogle: false });

    const toggle = await screen.findByRole('switch', { name: 'Relatório salvo' });
    expect(toggle).toBeEnabled();
    await user.click(toggle);
    expect(mocks.updateOrganizationFlag).toHaveBeenCalledWith('saved_report', true);
  });

  it('hides the write control for VIEWER', async () => {
    renderWithProviders(<OrganizationFlagsCard canManage={false} emailVerified />, {
      withGoogle: false,
    });

    const toggle = await screen.findByRole('switch', { name: 'Relatório salvo' });
    expect(toggle).toBeDisabled();
    expect(screen.getByText('Apenas proprietários ou administradores podem alterar flags.')).toBeInTheDocument();
    expect(mocks.updateOrganizationFlag).not.toHaveBeenCalled();
  });
});
