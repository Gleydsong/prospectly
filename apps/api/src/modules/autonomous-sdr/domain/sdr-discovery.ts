import { InvalidSdrDiscoveryError } from './sdr-errors';

export type DiscoveryCriteria = {
  organizationId: string;
  industries: string[];
  geographies: string[];
};

export type DiscoveredFact = {
  field: string;
  value: string;
  sourceUrl?: string;
};

export type DiscoveredProspect = {
  organizationId: string;
  dedupeKey: string;
  displayName: string;
  geography: string;
  website?: string;
  facts: DiscoveredFact[];
};

export interface ProspectDiscoveryProvider {
  search(criteria: DiscoveryCriteria): Promise<DiscoveredProspect[]>;
}

const CRITERIA_KEYS = new Set(['organizationId', 'industries', 'geographies']);

type CatalogEntry = {
  displayName: string;
  geography: string;
  industry: string;
  website?: string;
  organizationId?: string;
};

const FAKE_CATALOG: readonly CatalogEntry[] = [
  {
    displayName: 'Oficina Alfa',
    geography: 'Recife',
    industry: 'oficina',
    website: 'https://oficina-alfa.example',
  },
  {
    displayName: 'Oficina  Alfa',
    geography: 'Recife',
    industry: 'oficina',
    website: 'https://oficina-alfa.example',
  },
  {
    displayName: 'Padaria Beta',
    geography: 'Recife',
    industry: 'padaria',
    website: 'https://padaria-beta.example',
  },
  {
    displayName: 'Oficina Gama',
    geography: 'Olinda',
    industry: 'oficina',
    website: 'https://oficina-gama.example',
  },
  {
    displayName: 'Oficina de outro tenant',
    geography: 'Recife',
    industry: 'oficina',
    website: 'https://outra-org.example',
    organizationId: 'org-b',
  },
];

function fail(message: string): never {
  throw new InvalidSdrDiscoveryError(message);
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(message);
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(`${field} is required`);
  return value.trim();
}

function textList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0) fail(`${field} must not be empty`);
  return value.map((item, index) => {
    if (typeof item !== 'string' || item.trim() === '') fail(`${field}[${index}] is required`);
    return item.trim();
  });
}

export function parseDiscoveryCriteria(input: unknown): DiscoveryCriteria {
  const record = asRecord(input, 'Discovery criteria must be an object');
  for (const key of Object.keys(record)) {
    if (!CRITERIA_KEYS.has(key)) fail('Discovery criteria cannot judge a lead');
  }
  return {
    organizationId: requiredText(record.organizationId, 'organizationId'),
    industries: textList(record.industries, 'industries'),
    geographies: textList(record.geographies, 'geographies'),
  };
}

function hostOf(website: string): string {
  return website
    .replace(/^https:\/\//, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

function toProspect(entry: CatalogEntry, organizationId: string): DiscoveredProspect {
  const website = entry.website;
  const dedupeKey = website
    ? `${organizationId}|${hostOf(website)}`
    : `${organizationId}|${entry.displayName.trim().toLowerCase()}|${entry.geography.toLowerCase()}`;
  return {
    organizationId: entry.organizationId ?? organizationId,
    dedupeKey,
    displayName: entry.displayName.trim().replace(/\s+/g, ' '),
    geography: entry.geography,
    website,
    facts: [
      {
        field: 'category',
        value: entry.industry,
        sourceUrl: website,
      },
    ],
  };
}

function sameToken(left: string, right: string): boolean {
  return left.localeCompare(right, 'pt-BR', { sensitivity: 'accent' }) === 0;
}

export class FakeProspectDiscoveryProvider implements ProspectDiscoveryProvider {
  async search(criteria: DiscoveryCriteria): Promise<DiscoveredProspect[]> {
    return FAKE_CATALOG.filter(
      (entry) =>
        criteria.industries.some((industry) => sameToken(industry, entry.industry)) &&
        criteria.geographies.some((geography) => sameToken(geography, entry.geography)),
    ).map((entry) => toProspect(entry, criteria.organizationId));
  }
}

export function dedupeDiscoveredProspects(
  prospects: readonly DiscoveredProspect[],
): DiscoveredProspect[] {
  const seen = new Set<string>();
  const unique: DiscoveredProspect[] = [];
  for (const prospect of prospects) {
    if (seen.has(prospect.dedupeKey)) continue;
    seen.add(prospect.dedupeKey);
    unique.push(prospect);
  }
  return unique;
}

export function discoveryJobId(criteria: DiscoveryCriteria): string {
  const industries = [...criteria.industries].map((item) => item.toLocaleLowerCase('pt-BR')).sort();
  const geographies = [...criteria.geographies]
    .map((item) => item.toLocaleLowerCase('pt-BR'))
    .sort();
  return `${criteria.organizationId}|${industries.join(',')}|${geographies.join(',')}`;
}

export async function discoverProspects(
  provider: ProspectDiscoveryProvider,
  input: unknown,
  alreadyKnown: readonly DiscoveredProspect[] = [],
): Promise<DiscoveredProspect[]> {
  const criteria = parseDiscoveryCriteria(input);
  const found = await provider.search(criteria);
  const scoped = found.filter((prospect) => prospect.organizationId === criteria.organizationId);
  return dedupeDiscoveredProspects([...alreadyKnown, ...scoped]);
}
