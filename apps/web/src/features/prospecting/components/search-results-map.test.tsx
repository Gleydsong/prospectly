import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/features/theme/theme-provider';
import type { ProspectingSearchResult } from '@/types';
import { SearchResultsMap, searchResultsMapData } from './search-results-map';

const canvas = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
vi.mock('@/features/leads/components/client-map-canvas', () => ({
  default: (props: Record<string, unknown>) => {
    canvas.props = props;
    return <div aria-label="canvas stub" />;
  },
}));

function result(
  id: string,
  latitude?: number,
  longitude?: number,
  importedLeadId?: string,
): ProspectingSearchResult {
  const business = {
    companyName: id,
    externalId: id,
    city: 'Recife',
    state: 'PE',
    country: 'BR' as const,
    source: 'OPENSTREETMAP' as const,
    websitePresence: 'UNKNOWN' as const,
    latitude,
    longitude,
  };
  return {
    id,
    importedLeadId,
    data: business,
    normalizedData: business,
    websitePresence: 'UNKNOWN',
    createdAt: '2026-10-20',
  };
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('result map', () => {
  it('uses only unsaved current-page results with finite, valid coordinates, including zero', () => {
    const data = searchResultsMapData([
      result('zero', 0, 0),
      result('saved', 1, 1, 'client'),
      result('missing'),
      result('invalid', NaN, 10),
      result('out-of-range', 91, 0),
    ]);
    expect(data.pins.map((pin) => pin.id)).toEqual(['zero']);
    expect(data.meta.total).toBe(1);
  });

  it('shows a truthful fallback when coordinates are absent', () => {
    render(<SearchResultsMap results={[result('missing')]} onSelect={vi.fn()} />);
    expect(screen.getByText(/Nenhum resultado.*coordenadas/)).toBeInTheDocument();
  });

  it('reuses the canvas with a distinct result presentation and accessible selection', async () => {
    const onSelect = vi.fn();
    render(
      <ThemeProvider>
        <SearchResultsMap results={[result('company', 0, 0)]} onSelect={onSelect} />
      </ThemeProvider>,
    );
    await waitFor(() => expect(canvas.props.presentation).toBe('results'));
    await userEvent.selectOptions(screen.getByRole('combobox'), 'company');
    expect(onSelect).toHaveBeenCalledWith('company');
    expect(canvas.props.dark).toBe(false);
    act(() => (canvas.props.onError as () => void)());
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Mapa indisponível'));
  });
});

it('passes the night theme to the reused result canvas', async () => {
  document.documentElement.classList.add('dark');
  render(
    <ThemeProvider>
      <SearchResultsMap results={[result('night', 0, 0)]} onSelect={vi.fn()} />
    </ThemeProvider>,
  );
  await waitFor(() => expect(canvas.props.dark).toBe(true));
});
