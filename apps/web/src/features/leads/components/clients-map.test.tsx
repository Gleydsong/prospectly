import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { renderWithProviders } from '@/test/render';
import { LeadStatus, LeadSource } from '@/types';
import ClientsMap from './clients-map';

const canvas = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));
vi.mock('./client-map-canvas', () => ({
  WORLD_BBOX: '-180,-90,180,90',
  default: (props: Record<string, unknown>) => {
    canvas.props = props;
    return <div>Map canvas</div>;
  },
}));
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));
const pins = [
  {
    id: 'saved-a',
    name: 'Clínica Horizonte',
    latitude: -23,
    longitude: -46,
    status: LeadStatus.QUALIFIED,
  },
];
const details = {
  id: 'saved-a',
  companyName: 'Clínica Horizonte',
  city: 'São Paulo',
  state: 'SP',
  country: 'BR',
  status: LeadStatus.QUALIFIED,
  source: LeadSource.MANUAL,
  score: 92,
  website: 'https://example.test',
  whatsapp: '+5511999999999',
  doNotContact: false,
};

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.get).mockImplementation(async (url) => ({
    data:
      url === '/leads/map'
        ? { pins, clusters: [], meta: { total: 1, grouped: false, limit: 500 } }
        : details,
  }));
});

describe('Clients map portfolio', () => {
  it('requests saved pins with shared filters and viewport, loads selected client only on demand', async () => {
    renderWithProviders(
      <ClientsMap
        filters={{
          status: LeadStatus.QUALIFIED,
          city: 'São Paulo',
          segment: 'health',
          q: 'Clínica',
        }}
      />,
    );
    await screen.findByRole('combobox');
    expect(api.get).toHaveBeenCalledWith(
      '/leads/map',
      expect.objectContaining({
        params: {
          bbox: '-180,-90,180,90',
          status: LeadStatus.QUALIFIED,
          city: 'São Paulo',
          segment: 'health',
          q: 'Clínica',
        },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(api.get).not.toHaveBeenCalledWith('/leads/saved-a');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'saved-a' } });
    expect(await screen.findByRole('heading', { name: 'Clínica Horizonte' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir ficha' })).toHaveAttribute(
      'href',
      '/clientes/saved-a',
    );
    expect(screen.getByRole('link', { name: 'Chamar no WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/5511999999999',
    );
    const area = new URL(
      screen.getByRole('link', { name: 'Prospectar nesta área' }).getAttribute('href')!,
      'https://local.test',
    );
    expect(area.searchParams.has('area')).toBe(false);
    expect(area.searchParams.get('city')).toBe('São Paulo');
    expect(area.searchParams.get('state')).toBe('SP');
  });

  it('requires a client or city filter before offering regional prospecting', async () => {
    const view = renderWithProviders(<ClientsMap filters={{}} />);
    await screen.findByRole('combobox');
    expect(screen.getByRole('button', { name: 'Prospectar nesta área' })).toBeDisabled();
    expect(screen.getByText('Selecione um cliente ou filtre uma cidade')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Prospectar nesta área' })).not.toBeInTheDocument();
    view.rerender(<ClientsMap filters={{ city: 'Santos' }} />);
    const link = screen.getByRole('link', { name: 'Prospectar nesta área' });
    const url = new URL(link.getAttribute('href')!, 'https://local.test');
    expect(url.searchParams.get('city')).toBe('Santos');
    expect(url.searchParams.has('area')).toBe(false);
  });

  it('disables regional prospecting for a foreign city unsupported by the search form', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => ({
      data:
        url === '/leads/map'
          ? { pins, clusters: [], meta: { total: 1, grouped: false, limit: 500 } }
          : { ...details, city: 'Lisboa', state: 'Lisboa', country: 'PT' },
    }));
    renderWithProviders(<ClientsMap filters={{ city: 'Lisboa' }} />);
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'saved-a' } });
    await screen.findByRole('heading', { name: 'Clínica Horizonte' });
    expect(screen.getByRole('button', { name: 'Prospectar nesta área' })).toBeDisabled();
    expect(
      screen.getByTitle('A prospecção nesta área está disponível apenas para o Brasil.'),
    ).toBeInTheDocument();
  });

  it('shows an error state in the map header instead of remaining on loading', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network'));
    renderWithProviders(<ClientsMap filters={{}} />);
    await screen.findByRole('button', { name: 'Tentar novamente' });
    expect(screen.queryByText('Carregando…')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('does not offer outreach when selected client is do-not-contact', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => ({
      data:
        url === '/leads/map'
          ? { pins, clusters: [], meta: { total: 1, grouped: false, limit: 500 } }
          : { ...details, doNotContact: true },
    }));
    renderWithProviders(<ClientsMap filters={{}} />);
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'saved-a' } });
    await screen.findByText('Não contatar este cliente.');
    expect(screen.queryByRole('link', { name: 'Chamar no WhatsApp' })).not.toBeInTheDocument();
  });

  it('shows actual empty and grouped states, without invented totals', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { pins: [], clusters: [], meta: { total: 0, grouped: false, limit: 500 } },
    });
    const view = renderWithProviders(<ClientsMap filters={{}} />);
    await screen.findByRole('heading', { name: 'Nenhum cliente com localização nesta área' });
    expect(screen.getByRole('link', { name: 'Prospectar empresas' })).toBeInTheDocument();
    view.unmount();
    vi.mocked(api.get).mockResolvedValue({
      data: {
        pins: [],
        clusters: [{ latitude: -23, longitude: -46, count: 501 }],
        meta: { total: 501, grouped: true, limit: 500 },
      },
    });
    renderWithProviders(<ClientsMap filters={{}} />);
    await screen.findByText('501 clientes com localização nesta área');
    expect(screen.getByText('Aproxime para explorar cada cliente.')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('clears the selected client after filters change and retries endpoint errors', async () => {
    const view = renderWithProviders(<ClientsMap filters={{}} />);
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'saved-a' } });
    await screen.findByRole('heading', { name: 'Clínica Horizonte' });
    view.rerender(<ClientsMap filters={{ city: 'Santos' }} />);
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Clínica Horizonte' })).not.toBeInTheDocument(),
    );
    view.unmount();
    vi.mocked(api.get).mockRejectedValueOnce(new Error('network'));
    renderWithProviders(<ClientsMap filters={{}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar novamente' }));
    await screen.findByRole('combobox');
  });
});
