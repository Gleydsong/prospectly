import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/stores/auth.store';
import { Role } from '@/types';
import { PersonaOnboardingPage } from './persona-onboarding-page';

const orgApi = vi.hoisted(() => ({
  updateOrganizationPersona: vi.fn(),
}));

vi.mock('@/features/organizations/api', () => orgApi);

describe('PersonaOnboardingPage', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('pt');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'u1',
        name: 'Ana',
        email: 'ana@example.com',
        organizationId: 'org-1',
        organizationName: 'Acme',
        role: Role.OWNER,
        locale: 'pt',
        defaultPersona: 'vendedor',
        personaOverride: null,
        effectivePersona: 'vendedor',
        personaOnboardedAt: null,
      },
      accessToken: 'token',
      bootstrapped: true,
    });
  });

  it('patches the organization default persona and stores onboarding as complete', async () => {
    orgApi.updateOrganizationPersona.mockResolvedValueOnce({
      defaultPersona: 'desenvolvedor',
      personaOnboardedAt: '2026-09-14T12:00:00.000Z',
    });
    const user = userEvent.setup();
    renderWithProviders(<PersonaOnboardingPage />, { initialEntries: ['/onboarding/persona'] });

    await user.selectOptions(screen.getByLabelText(/persona/i), 'desenvolvedor');
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => {
      expect(orgApi.updateOrganizationPersona).toHaveBeenCalledWith('desenvolvedor');
      expect(useAuthStore.getState().user?.effectivePersona).toBe('desenvolvedor');
      expect(useAuthStore.getState().user?.personaOnboardedAt).toBe('2026-09-14T12:00:00.000Z');
    });
  });
});
