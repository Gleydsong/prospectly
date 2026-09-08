import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';

import { groupEmailsByThread, type SyncedCommunication } from './api';
import { SyncedCommunicationsCard } from './synced-communications-card';

const mocks = vi.hoisted(() => ({
  useSyncedCommunications: vi.fn(),
}));

vi.mock('@/features/communications/hooks', () => ({
  useSyncedCommunications: (...args: unknown[]) => mocks.useSyncedCommunications(...args),
}));

function mail(overrides: Partial<SyncedCommunication>): SyncedCommunication {
  return {
    id: 'sc-1',
    channel: 'EMAIL',
    externalId: 'msg-1',
    threadId: 'thread-1',
    occurredAt: '2026-08-20T09:00:00.000Z',
    direction: 'IN',
    from: ['lead@acme.com'],
    to: ['ana@gmail.com'],
    cc: [],
    subject: 'Proposta',
    snippet: 'Segue a proposta',
    htmlLink: 'https://mail.google.com/mail/u/0/#all/thread-1',
    ...overrides,
  };
}

describe('groupEmailsByThread', () => {
  it('groups by thread and keeps one row per message', () => {
    const threads = groupEmailsByThread([
      mail({
        id: 'a',
        externalId: 'm1',
        occurredAt: '2026-08-21T10:00:00.000Z',
        subject: 'Re: Proposta',
      }),
      mail({ id: 'b', externalId: 'm2', occurredAt: '2026-08-20T09:00:00.000Z' }),
      mail({
        id: 'c',
        externalId: 'm3',
        threadId: 'thread-2',
        occurredAt: '2026-08-22T11:00:00.000Z',
        subject: 'Outro',
      }),
    ]);
    expect(threads).toHaveLength(2);
    expect(threads[0]?.latest.subject).toBe('Outro');
    expect(threads[1]?.messages).toHaveLength(2);
  });
});

describe('SyncedCommunicationsCard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt');
    vi.clearAllMocks();
  });

  it('shows empty state and still renders for DNC leads', () => {
    mocks.useSyncedCommunications.mockReturnValue({ data: { data: [] }, isLoading: false });
    renderWithProviders(<SyncedCommunicationsCard leadId="lead-1" />, { withGoogle: false });
    expect(screen.getByText('E-mails sincronizados')).toBeInTheDocument();
    expect(screen.getByText(/ainda não há e-mails/i)).toBeInTheDocument();
  });

  it('lists a thread with open-in-Gmail link', () => {
    mocks.useSyncedCommunications.mockReturnValue({
      data: { data: [mail({})] },
      isLoading: false,
    });
    renderWithProviders(<SyncedCommunicationsCard leadId="lead-1" />, { withGoogle: false });
    expect(screen.getByText('Proposta')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /abrir no gmail/i })).toHaveAttribute(
      'href',
      'https://mail.google.com/mail/u/0/#all/thread-1',
    );
  });
});
