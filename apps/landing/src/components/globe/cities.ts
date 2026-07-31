export type LatLon = readonly [number, number];

export const CITIES = {
  saoPaulo: [-23.5505, -46.6333],
  mexicoCity: [19.4326, -99.1332],
  newYork: [40.7128, -74.006],
  toronto: [43.6532, -79.3832],
  losAngeles: [34.0522, -118.2437],
  lisbon: [38.7223, -9.1393],
  london: [51.5074, -0.1278],
  paris: [48.8566, 2.3522],
  madrid: [40.4168, -3.7038],
  lagos: [6.5244, 3.3792],
  dubai: [25.2048, 55.2708],
  mumbai: [19.076, 72.8777],
  singapore: [1.3521, 103.8198],
  tokyo: [35.6762, 139.6503],
  sydney: [-33.8688, 151.2093],
  capeTown: [-33.9249, 18.4241],
} as const satisfies Record<string, LatLon>;

export type CityId = keyof typeof CITIES;

/**
 * Dense network kept on the globe (reference-style connectivity web).
 * All of these stay drawn and rotate with the earth.
 */
export const NETWORK_LINKS: readonly (readonly [CityId, CityId])[] = [
  ['saoPaulo', 'lisbon'],
  ['saoPaulo', 'newYork'],
  ['saoPaulo', 'lagos'],
  ['mexicoCity', 'newYork'],
  ['mexicoCity', 'losAngeles'],
  ['losAngeles', 'tokyo'],
  ['losAngeles', 'sydney'],
  ['newYork', 'london'],
  ['newYork', 'paris'],
  ['toronto', 'london'],
  ['lisbon', 'london'],
  ['lisbon', 'madrid'],
  ['madrid', 'paris'],
  ['london', 'dubai'],
  ['paris', 'dubai'],
  ['paris', 'lagos'],
  ['lagos', 'capeTown'],
  ['capeTown', 'dubai'],
  ['dubai', 'mumbai'],
  ['mumbai', 'singapore'],
  ['mumbai', 'tokyo'],
  ['singapore', 'tokyo'],
  ['singapore', 'sydney'],
  ['tokyo', 'sydney'],
  ['sydney', 'saoPaulo'],
] as const;

/** Highlighted hops drawn one-by-one on top of the network. */
export const ROUTE_CHAIN: readonly CityId[] = [
  'saoPaulo',
  'lisbon',
  'london',
  'newYork',
  'tokyo',
  'sydney',
  'singapore',
  'dubai',
  'mumbai',
  'paris',
  'lagos',
  'capeTown',
  'saoPaulo',
  'mexicoCity',
  'losAngeles',
  'tokyo',
] as const;

export const MARKER_CITIES = Object.keys(CITIES) as CityId[];
