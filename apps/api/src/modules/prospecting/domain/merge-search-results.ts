import type { WebsitePresence } from '@prisma/client';

import type { NormalizedBusiness } from './normalized-business';

function digitsOnly(value: string | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Prefer richer contact/location fields when the same business appears in multiple providers. */
export function mergeBusinessFields(
  current: NormalizedBusiness,
  incoming: NormalizedBusiness,
): NormalizedBusiness {
  const preferIncomingWebsite =
    Boolean(incoming.website) &&
    (!current.website ||
      (incoming.websitePresence === 'WEBSITE_FOUND' && current.websitePresence !== 'WEBSITE_FOUND'));

  const websitePresence: WebsitePresence = preferIncomingWebsite
    ? incoming.websitePresence
    : current.websitePresence === 'WEBSITE_FOUND'
      ? current.websitePresence
      : incoming.websitePresence;

  return {
    ...current,
    phone: current.phone || incoming.phone,
    email: current.email || incoming.email,
    website: preferIncomingWebsite ? incoming.website : current.website || incoming.website,
    address:
      (current.address?.length ?? 0) >= (incoming.address?.length ?? 0)
        ? current.address || incoming.address
        : incoming.address || current.address,
    postalCode: current.postalCode || incoming.postalCode,
    latitude: current.latitude ?? incoming.latitude,
    longitude: current.longitude ?? incoming.longitude,
    category: current.category || incoming.category,
    websitePresence,
    // Keep Google Places as display source when it contributed richer contact data.
    source:
      incoming.source === 'GOOGLE_PLACES' && (incoming.phone || incoming.website) && !current.phone && !current.website
        ? 'GOOGLE_PLACES'
        : current.source,
    externalId:
      incoming.source === 'GOOGLE_PLACES' && (incoming.phone || incoming.website) && !current.phone && !current.website
        ? incoming.externalId
        : current.externalId,
  };
}

export function businessDedupeKey(business: NormalizedBusiness): string {
  const phone = digitsOnly(business.phone);
  if (phone.length >= 8) {
    return `phone:${phone.slice(-10)}`;
  }
  return `name:${normalizeName(business.companyName)}|city:${normalizeName(business.city)}|state:${business.state.trim().toUpperCase()}`;
}

/** Deduplicate across providers and enrich overlapping records. */
export function mergeProviderResults(businesses: NormalizedBusiness[]): NormalizedBusiness[] {
  const byExternal = new Map<string, NormalizedBusiness>();
  for (const business of businesses) {
    const existing = byExternal.get(business.externalId);
    if (!existing) {
      byExternal.set(business.externalId, business);
      continue;
    }
    byExternal.set(business.externalId, mergeBusinessFields(existing, business));
  }

  const byIdentity = new Map<string, NormalizedBusiness>();
  for (const business of byExternal.values()) {
    const key = businessDedupeKey(business);
    const existing = byIdentity.get(key);
    if (!existing) {
      byIdentity.set(key, business);
      continue;
    }
    byIdentity.set(key, mergeBusinessFields(existing, business));
  }

  return [...byIdentity.values()];
}
