function foldLocationPart(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Single-line address for lead detail: keep city/state once when the postal
 * address from Google/OSM already includes them.
 */
export function formatLeadAddressLine(input: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
}): string | undefined {
  const address = input.address?.trim() ?? '';
  const city = input.city?.trim() ?? '';
  const state = input.state?.trim() ?? '';
  if (!address && !city && !state) return undefined;
  if (!address) return [city, state].filter(Boolean).join(', ') || undefined;

  const foldedAddress = foldLocationPart(address);
  const parts = [address];
  if (city && !foldedAddress.includes(foldLocationPart(city))) {
    parts.push(city);
  }
  if (state && !foldedAddress.includes(foldLocationPart(state))) {
    parts.push(state);
  }
  return parts.join(', ');
}
