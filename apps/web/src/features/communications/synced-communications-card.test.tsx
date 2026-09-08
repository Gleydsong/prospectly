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

  it('does not mix calendar events into email threads', () => {
    const threads = groupEmailsByThread([
      mail({}),
      {
        ...mail({ id: 'evt', externalId: 'evt-1', threadId: null, subject: 'Kickoff' }),
        channel: 'CALENDAR',
        direction: 'EVENT',
        htmlLink: 'https://www.google.com/calendar/event?eid=evt-1',
      },
    ]);
    expect(threads).toHaveLength(1);
    expect(threads[0]?.latest.channel).toBe('EMAIL');
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
    expect(screen.getByText('Comunicações sincronizadas')).toBeInTheDocument();
    expect(screen.getByText(/ainda não há e-mails nem eventos/i)).toBeInTheDocument();
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

  it('lists past and future events with Open in Calendar', () => {
    mocks.useSyncedCommunications.mockReturnValue({
      data: {
        data: [
          {
            id: 'past',
            channel: 'CALENDAR' as const,
            externalId: 'evt-past',
            threadId: null,
            occurredAt: '2026-08-01T10:00:00.000Z',
            direction: 'EVENT' as const,
            from: ['ana@gmail.com'],
            to: ['lead@acme.com'],
            cc: [],
            subject: 'Kickoff',
            snippet: 'Sala 2',
            htmlLink: 'https://www.google.com/calendar/event?eid=evt-past',
          },
          {
            id: 'future',
            channel: 'CALENDAR' as const,
            externalId: 'evt-future',
            threadId: null,
            occurredAt: '2026-10-01T10:00:00.000Z',
            direction: 'EVENT' as const,
            from: ['ana@gmail.com'],
            to: ['lead@acme.com'],
            cc: [],
            subject: 'Demo',
            snippet: '',
            htmlLink: 'https://www.google.com/calendar/event?eid=evt-future',
          },
        ],
      },
      isLoading: false,
    });
    renderWithProviders(<SyncedCommunicationsCard leadId="lead-1" />, { withGoogle: false });
    expect(screen.getByText('Kickoff')).toBeInTheDocument();
    expect(screen.getByText('Demo')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: /abrir no calendar/i });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', 'https://www.google.com/calendar/event?eid=evt-past');
    expect(links[1]).toHaveAttribute('href', 'https://www.google.com/calendar/event?eid=evt-future');
  });
});
