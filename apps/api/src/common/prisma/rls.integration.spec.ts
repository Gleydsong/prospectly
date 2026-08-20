import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { runWithBypass, runWithTenant } from './tenant-context';
import { assertTenantOperation } from './tenant-guard';
import { extendPrismaClient } from './tenant-prisma';

const shouldRun = process.env.RUN_RLS_TEST === 'true';
const describeWithDatabase = shouldRun ? describe : describe.skip;

describeWithDatabase('Postgres RLS (tenant isolation)', () => {
  const databaseUrl = process.env.DATABASE_URL;
  const prisma = databaseUrl
    ? new PrismaClient({ datasources: { db: { url: databaseUrl } } })
    : null;

  const orgA = randomUUID();
  const orgB = randomUUID();
  const leadA = randomUUID();
  const leadB = randomUUID();
  const slugA = `rls-a-${orgA.slice(0, 8)}`;
  const slugB = `rls-b-${orgB.slice(0, 8)}`;

  beforeAll(async () => {
    if (!databaseUrl || !prisma) {
      throw new Error('DATABASE_URL is required when RUN_RLS_TEST=true');
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'on', true)`;
      await tx.$executeRawUnsafe(
        `INSERT INTO "Organization" (id, name, slug, plan, "planStatus", "creditBalance", "createdAt", "updatedAt")
         VALUES ($1, 'RLS A', $2, 'FREE', 'INACTIVE', 0, NOW(), NOW()),
                ($3, 'RLS B', $4, 'FREE', 'INACTIVE', 0, NOW(), NOW())`,
        orgA,
        slugA,
        orgB,
        slugB,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "Lead" (id, "organizationId", "companyName", source, status, score, "createdAt", "updatedAt")
         VALUES ($1, $2, 'Lead A', 'MANUAL', 'NEW', 0, NOW(), NOW()),
                ($3, $4, 'Lead B', 'MANUAL', 'NEW', 0, NOW(), NOW())`,
        leadA,
        orgA,
        leadB,
        orgB,
      );
    });
  });

  afterAll(async () => {
    if (!prisma) return;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'on', true)`;
      await tx.$executeRawUnsafe(
        `DELETE FROM "Lead" WHERE "organizationId" IN ($1, $2)`,
        orgA,
        orgB,
      );
      await tx.$executeRawUnsafe(`DELETE FROM "Organization" WHERE id IN ($1, $2)`, orgA, orgB);
    });
    await prisma.$disconnect();
  });

  it('creates the runtime role without LOGIN or BYPASSRLS', async () => {
    const role = await prisma!.$queryRaw<Array<{ rolcanlogin: boolean; rolbypassrls: boolean }>>`
      SELECT rolcanlogin, rolbypassrls
      FROM pg_roles
      WHERE rolname = 'prospectly_app'
    `;

    expect(role).toEqual([{ rolcanlogin: false, rolbypassrls: false }]);
  });

  it('returns only rows from the active organization', async () => {
    const rows = await prisma!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL ROLE prospectly_app`;
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgA}, true), set_config('app.current_user_id', '', true), set_config('app.rls_bypass', '', true)`;
      return tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Lead" ORDER BY id`;
    });

    expect(rows).toEqual([{ id: leadA }]);
  });

  it('rejects a cross-tenant insert', async () => {
    const foreignLeadId = randomUUID();

    await expect(
      prisma!.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL ROLE prospectly_app`;
        await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgA}, true), set_config('app.current_user_id', '', true), set_config('app.rls_bypass', '', true)`;
        await tx.$executeRaw`
          INSERT INTO "Lead" (id, "organizationId", "companyName", source, status, score, "createdAt", "updatedAt")
          VALUES (${foreignLeadId}, ${orgB}, 'Blocked cross-tenant insert', 'MANUAL', 'NEW', 0, NOW(), NOW())
        `;
      }),
    ).rejects.toThrow();
  });

  it('cannot update another organization row', async () => {
    const changed = await prisma!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL ROLE prospectly_app`;
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgA}, true), set_config('app.current_user_id', '', true), set_config('app.rls_bypass', '', true)`;
      return tx.$executeRaw`UPDATE "Lead" SET "companyName" = 'Leaked' WHERE id = ${leadB}`;
    });

    expect(changed).toBe(0);
  });

  it('keeps tenant GUCs on the same connection as extended client queries', async () => {
    const password = `rls-${randomUUID()}`;
    await prisma!.$executeRawUnsafe(
      `ALTER ROLE prospectly_app LOGIN PASSWORD '${password}'`,
    );

    const runtimeUrl = new URL(databaseUrl!);
    runtimeUrl.username = 'prospectly_app';
    runtimeUrl.password = password;
    const runtimePrisma = extendPrismaClient(
      new PrismaClient({ datasources: { db: { url: runtimeUrl.toString() } } }),
    );

    try {
      const bypassOrganization = await runWithBypass(async () =>
        runtimePrisma.organization.findUnique({ where: { id: orgA }, select: { id: true } }),
      );
      expect(bypassOrganization).toEqual({ id: orgA });

      const tenantRows = await runWithTenant(orgA, async () =>
        runtimePrisma.lead.findMany({
          where: { id: { in: [leadA, leadB] } },
          select: { id: true },
          orderBy: { id: 'asc' },
        }),
      );
      expect(tenantRows).toEqual([{ id: leadA }]);
    } finally {
      await runtimePrisma.$disconnect();
      await prisma!.$executeRawUnsafe('ALTER ROLE prospectly_app NOLOGIN PASSWORD NULL');
    }
  });
});

it('runWithTenant injects organizationId before a tenant query executes', () => {
  const args = { where: { id: 'lead-b' } };
  runWithTenant('org-a', () => {
    assertTenantOperation('Lead', 'findMany', args);
  });
  expect(args.where).toEqual({ id: 'lead-b', organizationId: 'org-a' });
});
