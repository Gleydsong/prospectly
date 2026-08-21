export interface GeographicBoundingBox {
  south: number;
  north: number;
  west: number;
  east: number;
}

export interface GoogleLocationRestriction {
  rectangle: {
    low: { latitude: number; longitude: number };
    high: { latitude: number; longitude: number };
  };
}

/** ~2 km so places on the municipal boundary are not dropped. */
const EDGE_PAD_DEGREES = 0.02;
/** Reject/shrink state-sized viewports that would pull nearby capitals back in. */
const MAX_SPAN_DEGREES = 2.5;

export function parseNominatimBoundingBox(raw: unknown): GeographicBoundingBox | undefined {
  if (!Array.isArray(raw) || raw.length < 4) return undefined;
  const south = Number(raw[0]);
  const north = Number(raw[1]);
  const west = Number(raw[2]);
  const east = Number(raw[3]);
  if (![south, north, west, east].every((value) => Number.isFinite(value))) return undefined;
  if (south >= north) return undefined;
  return { south, north, west, east };
}

export function padAndClampBoundingBox(box: GeographicBoundingBox): GeographicBoundingBox {
  let south = Math.max(-90, box.south - EDGE_PAD_DEGREES);
  let north = Math.min(90, box.north + EDGE_PAD_DEGREES);
  let west = box.west - EDGE_PAD_DEGREES;
  let east = box.east + EDGE_PAD_DEGREES;

  const latSpan = north - south;
  if (latSpan > MAX_SPAN_DEGREES) {
    const center = (north + south) / 2;
    south = center - MAX_SPAN_DEGREES / 2;
    north = center + MAX_SPAN_DEGREES / 2;
  }

  const lonSpan = east - west;
  if (lonSpan > MAX_SPAN_DEGREES) {
    const center = (east + west) / 2;
    west = center - MAX_SPAN_DEGREES / 2;
    east = center + MAX_SPAN_DEGREES / 2;
  }

  return { south, north, west, east };
}

export function toGoogleLocationRestriction(box: GeographicBoundingBox): GoogleLocationRestriction {
  const padded = padAndClampBoundingBox(box);
  return {
    rectangle: {
      low: { latitude: padded.south, longitude: padded.west },
      high: { latitude: padded.north, longitude: padded.east },
    },
  };
}
