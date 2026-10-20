import { useEffect, useRef } from 'react';
import {
  AttributionControl,
  Map,
  NavigationControl,
  setWorkerUrl,
  type FilterSpecification,
  type GeoJSONSource,
} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

import { LEAD_STATUS_COLORS } from '@/lib/lead-status-colors';
import type { ClientMapResult } from '../api';

setWorkerUrl(workerUrl);

const EMPTY = { type: 'FeatureCollection' as const, features: [] };
export const WORLD_BBOX = '-180,-90,180,90';

/** Normalize wrapped worlds while retaining antimeridian-crossing viewports. */
export function viewportBbox(west: number, south: number, east: number, north: number) {
  const wrap = (value: number) => ((((value + 180) % 360) + 360) % 360) - 180;
  const fullWorld = east - west >= 360;
  return [
    fullWorld ? -180 : wrap(west),
    Math.max(-90, south),
    fullWorld ? 180 : wrap(east),
    Math.min(90, north),
  ].join(',');
}

export function clientMapGeoJson(data: ClientMapResult) {
  return {
    type: 'FeatureCollection' as const,
    features: [
      ...data.pins.map((pin) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [pin.longitude, pin.latitude] },
        properties: { id: pin.id, status: pin.status, count: 1, grouped: false },
      })),
      ...data.clusters.map((cluster) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [cluster.longitude, cluster.latitude] },
        properties: { count: cluster.count, grouped: true },
      })),
    ],
  };
}

// Brand silhouette: vertical stem, circular eye and diagonal point, with white counterform.
function pinImage(color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.scale(2, 2);
  const outline = new Path2D('M4 38V15C4 7 10 2 17 2C24 2 30 8 30 15C30 21 23 28 16 35L11 28V38Z');
  ctx.fillStyle = color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.fill(outline);
  ctx.stroke(outline);
  ctx.beginPath();
  ctx.arc(17, 15, 5.5, 0, Math.PI * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.stroke();
  return ctx.getImageData(0, 0, 64, 80);
}

interface Props {
  data?: ClientMapResult;
  compact?: boolean;
  dark: boolean;
  label: string;
  onViewport: (bbox: string) => void;
  onSelect: (id: string) => void;
  onError: () => void;
  onReady: () => void;
}

export default function ClientMapCanvas({
  data,
  compact = false,
  dark,
  label,
  onViewport,
  onSelect,
  onError,
  onReady,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const latest = useRef({ data, dark, onViewport, onSelect, onError, onReady });
  latest.current = { data, dark, onViewport, onSelect, onError, onReady };
  const fitted = useRef(false);
  const receivedPortfolio = useRef(false);
  const previousDark = useRef(dark);

  useEffect(() => {
    if (!container.current) return;
    let map: Map;
    try {
      map = new Map({
        container: container.current,
        style: dark
          ? 'https://tiles.openfreemap.org/styles/dark'
          : 'https://tiles.openfreemap.org/styles/positron',
        center: [-47, -15],
        zoom: 2,
        maxZoom: 19,
        attributionControl: false,
      });
    } catch {
      latest.current.onError();
      return;
    }
    mapRef.current = map;
    fitted.current = false;
    receivedPortfolio.current = false;
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(
      new AttributionControl({ compact: false, customAttribution: '© OpenStreetMap' }),
    );
    map.on('error', () => latest.current.onError());
    map.on('idle', () => latest.current.onReady());
    map.on('moveend', () => {
      // Initial MapLibre layout can move the camera before the portfolio response.
      // Keep that world query alive until its clients determine the initial bounds.
      if (!receivedPortfolio.current) return;
      const bounds = map.getBounds();
      latest.current.onViewport(
        viewportBbox(bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()),
      );
    });
    map.on('style.load', () => {
      for (const [status, colors] of Object.entries(LEAD_STATUS_COLORS)) {
        if (!map.hasImage(`client-${status}`)) {
          map.addImage(`client-${status}`, pinImage(colors.light.pin), { pixelRatio: 2 });
        }
      }
      const source = map.getSource('clients') as GeoJSONSource | undefined;
      if (source)
        source.setData(latest.current.data ? clientMapGeoJson(latest.current.data) : EMPTY);
      else
        map.addSource('clients', {
          type: 'geojson',
          data: latest.current.data ? clientMapGeoJson(latest.current.data) : EMPTY,
          cluster: true,
          clusterRadius: 48,
          clusterMaxZoom: 18,
          maxzoom: 19,
          clusterProperties: { count: ['+', ['get', 'count']] },
        });
      const clusterFilter: FilterSpecification = [
        'any',
        ['has', 'point_count'],
        ['==', ['get', 'grouped'], true],
      ];
      if (!map.getLayer('client-clusters'))
        map.addLayer({
          id: 'client-clusters',
          type: 'circle',
          source: 'clients',
          filter: clusterFilter,
          paint: {
            'circle-color': '#2563eb',
            'circle-radius': 23,
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 3,
          },
        });
      if (!map.getLayer('client-counts'))
        map.addLayer({
          id: 'client-counts',
          type: 'symbol',
          source: 'clients',
          filter: clusterFilter,
          layout: {
            'text-field': ['to-string', ['get', 'count']],
            'text-font': ['Noto Sans Regular'],
            'text-size': 13,
            'text-allow-overlap': true,
          },
          paint: { 'text-color': '#fff' },
        });
      if (!map.getLayer('client-pins'))
        map.addLayer({
          id: 'client-pins',
          type: 'symbol',
          source: 'clients',
          filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'grouped'], false]],
          layout: {
            'icon-image': ['concat', 'client-', ['get', 'status']],
            'icon-anchor': 'bottom',
            'icon-allow-overlap': true,
          },
        });
    });
    map.on('click', 'client-pins', (event) => {
      const id = event.features?.[0]?.properties.id;
      if (typeof id === 'string') latest.current.onSelect(id);
    });
    map.on('click', 'client-clusters', async (event) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== 'Point') return;
      const coordinates = feature.geometry.coordinates as [number, number];
      let zoom = Math.min(19, map.getZoom() + 2);
      if (feature.properties.cluster_id !== undefined) {
        try {
          zoom = await (map.getSource('clients') as GeoJSONSource).getClusterExpansionZoom(
            Number(feature.properties.cluster_id),
          );
        } catch {
          return;
        }
      }
      if (mapRef.current !== map) return;
      map.easeTo({ center: coordinates, zoom, duration: 0 });
    });
    for (const layer of ['client-pins', 'client-clusters']) {
      map.on('mouseenter', layer, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layer, () => {
        map.getCanvas().style.cursor = '';
      });
    }
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      mapRef.current = null;
      map.remove();
    };
    // The map instance survives filters and theme changes; sources/styles update below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || previousDark.current === dark) return;
    previousDark.current = dark;
    map.setStyle(
      dark
        ? 'https://tiles.openfreemap.org/styles/dark'
        : 'https://tiles.openfreemap.org/styles/positron',
    );
  }, [dark]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    (map.getSource('clients') as GeoJSONSource | undefined)?.setData(
      data ? clientMapGeoJson(data) : EMPTY,
    );
    if (!data) return;
    receivedPortfolio.current = true;
    // First response covers the organization worldwide, so the initial camera never hides its clients.
    if (!fitted.current) {
      if (data.meta.total === 0) return;
      fitted.current = true;
      const points = [...data.pins, ...data.clusters];
      const lngs = points.map((p) => p.longitude);
      const lats = points.map((p) => p.latitude);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 65, maxZoom: 14, duration: 0 },
      );
    }
  }, [data]);

  return (
    <div
      ref={container}
      role="region"
      aria-label={label}
      className={`min-w-0 overflow-hidden rounded-panel border border-[color:var(--border)] bg-[color:var(--bg-subtle)] ${compact ? 'h-[300px] sm:h-[340px]' : 'h-[520px] lg:h-[630px]'}`}
    />
  );
}
