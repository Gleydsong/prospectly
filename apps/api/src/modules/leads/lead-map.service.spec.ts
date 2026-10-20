import { BadRequestException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { LeadMapService, parseMapBounds } from './lead-map.service';

describe('LeadMapService', () => {
  const queryRaw = jest.fn();
  const service = new LeadMapService({ $queryRaw: queryRaw } as unknown as PrismaService);

  beforeEach(() => queryRaw.mockReset());

  it.each([
    '',
    '0,0,1',
    '0,,1,1',
    '0,0,Infinity,1',
    'NaN,0,1,1',
    '-181,0,1,1',
    '0,-91,1,1',
    '0,0,181,1',
    '0,0,1,91',
    '0,1,1,0',
    '0,0,0,1',
    '180,-90,-180,90',
  ])('rejects invalid bounding box %s before database access', async (bbox) => {
    await expect(service.list('org-a', { bbox })).rejects.toThrow(BadRequestException);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('accepts full globe and antimeridian bounds', () => {
    expect(parseMapBounds('-180,-90,180,90')).toEqual([-180, -90, 180, 90]);
    expect(parseMapBounds('170,-10,-170,10')).toEqual([170, -10, -170, 10]);
  });

  it('projects only minimal pin fields and binds tenant and filters as parameters', async () => {
    queryRaw.mockResolvedValue([
      {
        id: 'a',
        name: 'Cliente A',
        latitude: 1,
        longitude: 2,
        status: 'NEW',
        count: 1n,
        total: 1n,
      },
    ]);
    expect(
      await service.list('org-a', {
        bbox: '-10,-10,10,10',
        status: 'NEW',
        segment: "x' OR true --",
        city: 'Lisboa',
        q: 'Acme',
      }),
    ).toEqual({
      pins: [{ id: 'a', name: 'Cliente A', latitude: 1, longitude: 2, status: 'NEW' }],
      clusters: [],
      meta: { total: 1, grouped: false, limit: 500 },
    });
    const sql = queryRaw.mock.calls[0][0] as { text: string; values: unknown[] };
    expect(sql.text).toContain('"organizationId" = $');
    expect(sql.text).toContain('"deletedAt" IS NULL');
    expect(sql.text).not.toContain("x' OR true --");
    expect(sql.values).toEqual(
      expect.arrayContaining(['org-a', 'NEW', "x' OR true --", '%Lisboa%', '%Acme%']),
    );
  });

  it('returns server clusters with exact total above the hard pin limit', async () => {
    queryRaw.mockResolvedValue([
      { id: null, name: null, latitude: 1, longitude: 2, status: null, count: 300n, total: 501n },
      { id: null, name: null, latitude: 2, longitude: 3, status: null, count: 201n, total: 501n },
    ]);
    expect(await service.list('org-a', { bbox: '-180,-90,180,90' })).toEqual({
      pins: [],
      clusters: [
        { latitude: 1, longitude: 2, count: 300 },
        { latitude: 2, longitude: 3, count: 201 },
      ],
      meta: { total: 501, grouped: true, limit: 500 },
    });
  });

  it('returns an empty result without fabricated coordinates', async () => {
    queryRaw.mockResolvedValue([]);
    expect(await service.list('org-a', { bbox: '-180,-90,180,90' })).toEqual({
      pins: [],
      clusters: [],
      meta: { total: 0, grouped: false, limit: 500 },
    });
  });
});
