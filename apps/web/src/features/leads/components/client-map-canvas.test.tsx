import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { LeadStatus } from '@/types';
import ClientMapCanvas, { clientMapGeoJson, viewportBbox } from './client-map-canvas';

const map = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: never[]) => void>,
  addSource: vi.fn(),
  addImage: vi.fn(),
  addLayer: vi.fn(),
  remove: vi.fn(),
  fitBounds: vi.fn(),
  setStyle: vi.fn(),
  setData: vi.fn(),
  sourceExists: false,
}));
vi.mock('maplibre-gl', () => ({
  setWorkerUrl: vi.fn(),
  AttributionControl: vi.fn(),
  NavigationControl: vi.fn(),
  Map: vi.fn().mockImplementation(() => ({
    addControl: vi.fn(),
    hasImage: () => false,
    getLayer: () => undefined,
    addSource: (...args: unknown[]) => {
      map.sourceExists = true;
      map.addSource(...args);
    },
    addImage: map.addImage,
    addLayer: map.addLayer,
    setStyle: map.setStyle,
    remove: map.remove,
    fitBounds: map.fitBounds,
    getBounds: () => ({
      getWest: () => -10,
      getSouth: () => 30,
      getEast: () => 0,
      getNorth: () => 45,
    }),
    on: (event: string, callback: unknown) => {
      if (typeof callback === 'function') map.handlers[event] = callback as never;
    },
    getSource: () => (map.sourceExists ? { setData: map.setData } : undefined),
  })),
}));
const data = {
  pins: [{ id: 'saved', name: 'Client', latitude: 0, longitude: 0, status: LeadStatus.NEW }],
  clusters: [],
  meta: { total: 1, grouped: false, limit: 500 },
};

beforeEach(() => {
  vi.clearAllMocks();
  map.handlers = {};
  map.sourceExists = false;
  vi.stubGlobal(
    'ResizeObserver',
    vi.fn().mockImplementation(() => ({ observe: vi.fn(), disconnect: vi.fn() })),
  );
  vi.stubGlobal('Path2D', vi.fn());
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    scale: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    getImageData: () => ({ width: 64, height: 80 }),
  } as never);
});

describe('MapLibre source lifecycle', () => {
  it('keeps the world query until the first portfolio response before querying the viewport', () => {
    const props = {
      dark: false,
      label: 'Clients',
      onViewport: vi.fn(),
      onSelect: vi.fn(),
      onError: vi.fn(),
      onReady: vi.fn(),
    };
    const view = renderWithProviders(<ClientMapCanvas {...props} />);
    act(() => map.handlers.moveend?.());
    expect(props.onViewport).not.toHaveBeenCalled();
    view.rerender(<ClientMapCanvas {...props} data={data} />);
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    act(() => map.handlers.moveend?.());
    expect(props.onViewport).toHaveBeenCalledWith('-10,30,0,45');
  });

  it('allows viewport searches after an empty initial portfolio response', () => {
    const props = {
      dark: false,
      label: 'Clients',
      onViewport: vi.fn(),
      onSelect: vi.fn(),
      onError: vi.fn(),
      onReady: vi.fn(),
    };
    renderWithProviders(
      <ClientMapCanvas
        {...props}
        data={{ pins: [], clusters: [], meta: { total: 0, grouped: false, limit: 500 } }}
      />,
    );
    expect(map.fitBounds).not.toHaveBeenCalled();
    act(() => map.handlers.moveend?.());
    expect(props.onViewport).toHaveBeenCalledWith('-10,30,0,45');
  });
  it('normalizes wrapped viewports and preserves crossing antimeridian boxes', () => {
    expect(viewportBbox(-200, -100, 200, 100)).toBe('-180,-90,180,90');
    expect(viewportBbox(170, -20, 190, 20)).toBe('170,-20,-170,20');
    expect(clientMapGeoJson(data).features[0]?.geometry.coordinates).toEqual([0, 0]);
  });
  it('reapplies latest saved clients on style load/theme changes and disposes the map', () => {
    const props = {
      dark: false,
      label: 'Clients',
      onViewport: vi.fn(),
      onSelect: vi.fn(),
      onError: vi.fn(),
      onReady: vi.fn(),
    };
    const view = renderWithProviders(<ClientMapCanvas {...props} />);
    view.rerender(<ClientMapCanvas {...props} data={data} />);
    act(() => map.handlers['style.load']?.());
    expect(map.addSource).toHaveBeenLastCalledWith(
      'clients',
      expect.objectContaining({ data: clientMapGeoJson(data), cluster: true, maxzoom: 19 }),
    );
    view.rerender(<ClientMapCanvas {...props} dark data={data} />);
    act(() => map.handlers['style.load']?.());
    expect(map.setStyle).toHaveBeenCalledWith('https://tiles.openfreemap.org/styles/dark');
    expect(map.addSource).toHaveBeenLastCalledWith(
      'clients',
      expect.objectContaining({ data: clientMapGeoJson(data) }),
    );
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    view.rerender(<ClientMapCanvas {...props} dark />);
    expect(map.setData).toHaveBeenLastCalledWith({ type: 'FeatureCollection', features: [] });
    view.unmount();
    expect(map.remove).toHaveBeenCalledTimes(1);
  });
});
