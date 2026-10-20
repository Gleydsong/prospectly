import { BadRequestException, Injectable } from '@nestjs/common';
import { LeadStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { QueryLeadMapDto } from './dto/query-lead-map.dto';

export const MAP_PIN_LIMIT = 500;
const GRID_SIZE = 20;

type MapRow = {
  id: string | null;
  name: string | null;
  latitude: number;
  longitude: number;
  status: LeadStatus | null;
  count: bigint;
  total: bigint;
};

export function parseMapBounds(bbox: string): [number, number, number, number] {
  const parts = typeof bbox === 'string' ? bbox.split(',') : [];
  const bounds = parts.map((part) => Number(part.trim()));
  const [west, south, east, north] = bounds as [number, number, number, number];
  if (
    parts.length !== 4 ||
    parts.some((part) => !part.trim()) ||
    bounds.some((value) => !Number.isFinite(value)) ||
    Math.abs(west) > 180 ||
    Math.abs(east) > 180 ||
    Math.abs(south) > 90 ||
    Math.abs(north) > 90 ||
    south >= north ||
    west === east ||
    (west === 180 && east === -180)
  ) {
    throw new BadRequestException('bbox must be west,south,east,north within geographic bounds');
  }
  return [west, south, east, north];
}

@Injectable()
export class LeadMapService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: QueryLeadMapDto) {
    const [west, south, east, north] = parseMapBounds(query.bbox);
    const longitude =
      west > east
        ? Prisma.sql`("longitude" >= ${west} OR "longitude" <= ${east})`
        : Prisma.sql`"longitude" BETWEEN ${west} AND ${east}`;
    const width = west > east ? 360 - west + east : east - west;
    const predicates = [
      Prisma.sql`"organizationId" = ${organizationId}`,
      Prisma.sql`"deletedAt" IS NULL`,
      Prisma.sql`"latitude" BETWEEN ${south} AND ${north}`,
      Prisma.sql`"longitude" BETWEEN -180 AND 180`,
      longitude,
    ];
    if (query.status) predicates.push(Prisma.sql`status = ${query.status}::"LeadStatus"`);
    if (query.segment) predicates.push(Prisma.sql`lower(segment) = lower(${query.segment})`);
    if (query.city) predicates.push(Prisma.sql`city ILIKE ${`%${query.city}%`}`);
    if (query.q) {
      const term = `%${query.q}%`;
      predicates.push(Prisma.sql`("companyName" ILIKE ${term} OR "tradeName" ILIKE ${term}
        OR email ILIKE ${term} OR domain ILIKE ${term} OR city ILIKE ${term})`);
    }

    // One statement gives pins, groups and exact totals the same database snapshot.
    // Grid coordinates are relative to the viewport, including antimeridian views.
    const rows = await this.prisma.$queryRaw<MapRow[]>(Prisma.sql`
      WITH matched AS MATERIALIZED (
        SELECT id, "companyName" AS name, latitude, longitude, status,
          LEAST(${GRID_SIZE - 1}, floor((latitude - ${south}) / ${north - south} * ${GRID_SIZE})) AS y,
          LEAST(${GRID_SIZE - 1}, floor(
            (CASE WHEN longitude < ${west} THEN longitude + 360 ELSE longitude END - ${west})
            / ${width} * ${GRID_SIZE})) AS x
        FROM "Lead" WHERE ${Prisma.join(predicates, ' AND ')}
      ), stats AS (SELECT count(*) AS total FROM matched)
      SELECT id, name, latitude, longitude, status, 1::bigint AS count, total
      FROM matched CROSS JOIN stats WHERE total <= ${MAP_PIN_LIMIT}
      UNION ALL
      SELECT NULL AS id, NULL AS name, avg(latitude) AS latitude,
        CASE WHEN ${west > east} THEN
          CASE WHEN avg(CASE WHEN longitude < ${west} THEN longitude + 360 ELSE longitude END) > 180
            THEN avg(CASE WHEN longitude < ${west} THEN longitude + 360 ELSE longitude END) - 360
            ELSE avg(CASE WHEN longitude < ${west} THEN longitude + 360 ELSE longitude END) END
          ELSE avg(longitude) END AS longitude,
        NULL::"LeadStatus" AS status, count(*) AS count, total
      FROM matched CROSS JOIN stats WHERE total > ${MAP_PIN_LIMIT}
      GROUP BY x, y, total
      ORDER BY latitude, longitude, id
      LIMIT ${MAP_PIN_LIMIT}
    `);
    const total = Number(rows[0]?.total ?? 0);
    const grouped = total > MAP_PIN_LIMIT;
    return {
      pins: grouped
        ? []
        : rows.map((row) => ({
            id: row.id!,
            name: row.name!,
            latitude: row.latitude,
            longitude: row.longitude,
            status: row.status!,
          })),
      clusters: grouped
        ? rows.map((row) => ({
            latitude: row.latitude,
            longitude: row.longitude,
            count: Number(row.count),
          }))
        : [],
      meta: { total, grouped, limit: MAP_PIN_LIMIT },
    };
  }
}
