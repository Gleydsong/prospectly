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

  it('does not show a step counter, since onboarding is a single step', () => {
    renderWithProviders(<PersonaOnboardingPage />, { initialEntries: ['/onboarding/persona'] });
    expect(screen.queryByText(/Passo \d de \d/)).not.toBeInTheDocument();
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
      expect(orgApi.updateOrganizationPersona).toHaveBeenCalledWith({
        defaultPersona: 'desenvolvedor',
        personaOtherLabel: null,
      });
      expect(useAuthStore.getState().user?.effectivePersona).toBe('desenvolvedor');
      expect(useAuthStore.getState().user?.personaOnboardedAt).toBe('2026-09-14T12:00:00.000Z');
    });
  });

  it('reveals the other label and requires it before continuing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PersonaOnboardingPage />, { initialEntries: ['/onboarding/persona'] });

    expect(screen.queryByLabelText('Como você trabalha?')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/persona profissional/i), 'outro');
    expect(screen.getByLabelText('Como você trabalha?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /continuar/i }));
    expect(orgApi.updateOrganizationPersona).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/2 a 40/i);
  });

  it('sends the trimmed other label when Outro is selected', async () => {
    orgApi.updateOrganizationPersona.mockResolvedValueOnce({
      defaultPersona: 'outro',
      personaOtherLabel: 'Fotógrafo',
      personaOnboardedAt: '2026-09-14T12:00:00.000Z',
    });
    const user = userEvent.setup();
    renderWithProviders(<PersonaOnboardingPage />, { initialEntries: ['/onboarding/persona'] });

    await user.selectOptions(screen.getByLabelText(/persona profissional/i), 'outro');
    await user.type(screen.getByLabelText('Como você trabalha?'), 'Fotógrafo');
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => {
      expect(orgApi.updateOrganizationPersona).toHaveBeenCalledWith({
        defaultPersona: 'outro',
        personaOtherLabel: 'Fotógrafo',
      });
    });
  });
});
