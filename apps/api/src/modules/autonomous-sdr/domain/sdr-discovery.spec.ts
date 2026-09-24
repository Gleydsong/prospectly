import { InvalidSdrDiscoveryError } from './sdr-errors';
import {
  FakeProspectDiscoveryProvider,
  discoveryJobId,
  discoverProspects,
  parseDiscoveryCriteria,
} from './sdr-discovery';

const criteria = {
  organizationId: 'org-a',
  industries: ['oficina'],
  geographies: ['Recife'],
};

describe('discoverProspects', () => {
  it('returns fake facts for the organization and drops duplicates', async () => {
    const provider = new FakeProspectDiscoveryProvider();

    const first = await discoverProspects(provider, criteria);
    const second = await discoverProspects(provider, criteria);
    const combined = await discoverProspects(provider, criteria, [...first, ...second]);

    expect(first).toEqual([
      {
        organizationId: 'org-a',
        dedupeKey: 'org-a|oficina-alfa.example',
        displayName: 'Oficina Alfa',
        geography: 'Recife',
        website: 'https://oficina-alfa.example',
        facts: [{ field: 'category', value: 'oficina', sourceUrl: 'https://oficina-alfa.example' }],
      },
    ]);
    expect(combined).toEqual(first);
    expect(second.every((prospect) => prospect.organizationId === 'org-a')).toBe(true);
    expect(JSON.stringify(first)).not.toContain('qualified');
    expect(JSON.stringify(first)).not.toContain('score');
  });

  it('rejects criteria without an organization or structured filters', async () => {
    const provider = new FakeProspectDiscoveryProvider();

    await expect(
      discoverProspects(provider, { ...criteria, organizationId: ' ' }),
    ).rejects.toBeInstanceOf(InvalidSdrDiscoveryError);
    await expect(
      discoverProspects(provider, { ...criteria, industries: [] }),
    ).rejects.toBeInstanceOf(InvalidSdrDiscoveryError);
    await expect(
      discoverProspects(provider, { ...criteria, qualify: true }),
    ).rejects.toBeInstanceOf(InvalidSdrDiscoveryError);
  });

  it('builds the same job id for the same organization and filters', () => {
    const parsed = parseDiscoveryCriteria(criteria);
    const reordered = parseDiscoveryCriteria({
      organizationId: 'org-a',
      industries: ['oficina'],
      geographies: ['Recife'],
    });

    expect(discoveryJobId(parsed)).toBe(discoveryJobId(reordered));
    expect(
      discoveryJobId(parseDiscoveryCriteria({ ...criteria, organizationId: 'org-b' })),
    ).not.toBe(discoveryJobId(parsed));
  });
});
