import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { Role } from '@/types';

import { GoogleConnectionSettingsCard } from './google-connection-settings-card';

const mocks = vi.hoisted(() => ({
  fetchMyGoogleConnection: vi.fn(),
  startGoogleConnection: vi.fn(),
  disconnectGoogleConnection: vi.fn(),
  assign: vi.fn(),
}));

vi.mock('@/features/google-connections/api', () => ({
  fetchMyGoogleConnection: () => mocks.fetchMyGoogleConnection(),
  startGoogleConnection: () => mocks.startGoogleConnection(),
  disconnectGoogleConnection: () => mocks.disconnectGoogleConnection(),
}));

describe('GoogleConnectionSettingsCard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt');
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { assign: mocks.assign },
    });
  });

  it('lets SALES start OAuth from account settings', async () => {
    mocks.fetchMyGoogleConnection.mockResolvedValue({
      connected: false,
      googleEmail: null,
      connectedAt: null,
      lastError: null,
    });
    mocks.startGoogleConnection.mockResolvedValue({ url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' });
    const user = userEvent.setup();
    renderWithProviders(<GoogleConnectionSettingsCard role={Role.SALES} />, { withGoogle: false });

    await user.click(await screen.findByRole('button', { name: 'Ligar Google' }));
    expect(mocks.startGoogleConnection).toHaveBeenCalled();
    expect(mocks.assign).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?x=1');
  });

  it('hides connect from VIEWER', async () => {
    mocks.fetchMyGoogleConnection.mockResolvedValue({
      connected: false,
      googleEmail: null,
      connectedAt: null,
      lastError: null,
    });
    renderWithProviders(<GoogleConnectionSettingsCard role={Role.VIEWER} />, { withGoogle: false });

    expect(await screen.findByText(/não pode ligar/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ligar Google' })).not.toBeInTheDocument();
  });

  it('lets the owner disconnect', async () => {
    mocks.fetchMyGoogleConnection.mockResolvedValue({
      connected: true,
      googleEmail: 'ana@gmail.com',
      connectedAt: '2026-09-07T12:00:00.000Z',
      lastError: null,
    });
    mocks.disconnectGoogleConnection.mockResolvedValue({
      connected: false,
      googleEmail: null,
      connectedAt: null,
      lastError: null,
    });
    const user = userEvent.setup();
    renderWithProviders(<GoogleConnectionSettingsCard role={Role.OWNER} />, { withGoogle: false });

    await user.click(await screen.findByRole('button', { name: 'Desligar' }));
    expect(mocks.disconnectGoogleConnection).toHaveBeenCalled();
  });
});
