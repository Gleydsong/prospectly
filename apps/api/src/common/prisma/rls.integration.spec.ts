import { randomUUID } from 'node:crypto';

import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

import type { PrismaService } from './prisma.service';
import { runWithBypass, runWithTenant } from './tenant-context';
import { assertTenantOperation } from './tenant-guard';
import { extendPrismaClient } from './tenant-prisma';
import { JwtStrategy } from '../../modules/auth/strategies/jwt.strategy';

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
  const userA = randomUUID();
  const userB = randomUUID();
  const memberAOrgA = randomUUID();
  const memberBOrgB = randomUUID();
  const checkoutAttemptA = randomUUID();
  const checkoutAttemptB = randomUUID();
  const billingProfileA = randomUUID();
  const billingProfileB = randomUUID();
  const outboxEventA = randomUUID();
  const outboxEventB = randomUUID();
  const savedViewA = randomUUID();
  const savedViewB = randomUUID();
  const workflowA = randomUUID();
  const workflowB = randomUUID();
  const workflowVersionA = randomUUID();
  const workflowVersionB = randomUUID();
  const workflowStepRunA = randomUUID();
  const workflowStepRunB = randomUUID();
  const customFieldA = randomUUID();
  const customFieldB = randomUUID();
  const googleConnectionA = randomUUID();
  const googleConnectionB = randomUUID();
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
      await tx.$executeRaw`
        INSERT INTO "User" (id, email, name, locale, "createdAt", "updatedAt")
        VALUES (${userA}, ${`rls-a-${userA.slice(0, 8)}@example.test`}, 'RLS User A', 'pt'::"AppLocale", NOW(), NOW()),
               (${userB}, ${`rls-b-${userB.slice(0, 8)}@example.test`}, 'RLS User B', 'pt'::"AppLocale", NOW(), NOW())
      `;
      const memberInserts = await tx.$executeRaw`
        INSERT INTO "OrganizationMember" (id, "userId", "organizationId", role, "createdAt", "updatedAt")
        VALUES (${memberAOrgA}, ${userA}, ${orgA}, 'OWNER'::"Role", NOW(), NOW()),
               (${memberBOrgB}, ${userB}, ${orgB}, 'MEMBER'::"Role", NOW(), NOW())
      `;
      if (memberInserts !== 2) {
        throw new Error(`Expected 2 organization members, inserted ${memberInserts}`);
      }
      await tx.$executeRaw`
        INSERT INTO "MonthlyCheckoutAttempt"
          (id, "organizationId", provider, "paymentMethod", status, "externalId", "createdAt", "updatedAt")
        VALUES
          (${checkoutAttemptA}, ${orgA}, 'ABACATE'::"PaymentProvider", 'CARD'::"BillingPaymentMethod", 'PROCESSING'::"BillingCheckoutAttemptStatus", ${`rls-checkout-${checkoutAttemptA}`}, NOW(), NOW()),
          (${checkoutAttemptB}, ${orgB}, 'ABACATE'::"PaymentProvider", 'CARD'::"BillingPaymentMethod", 'PROCESSING'::"BillingCheckoutAttemptStatus", ${`rls-checkout-${checkoutAttemptB}`}, NOW(), NOW())
      `;
      await tx.$executeRaw`
        INSERT INTO "BillingProfile"
          (id, "organizationId", name, "cpfCnpj", phone, email, "createdAt", "updatedAt")
        VALUES
          (${billingProfileA}, ${orgA}, 'Billing A', '11111111111', '11999999999', 'a@example.test', NOW(), NOW()),
          (${billingProfileB}, ${orgB}, 'Billing B', '22222222222', '21999999999', 'b@example.test', NOW(), NOW())
      `;
      await tx.$executeRaw`
        INSERT INTO "OutboxEvent"
          (id, "organizationId", type, "schemaVersion", "aggregateType", "aggregateId", "idempotencyKey", payload, status, attempts, "retainUntil", "createdAt", "updatedAt")
        VALUES
          (${outboxEventA}, ${orgA}, 'task.completed', 1, 'Task', ${leadA}, ${`key-${outboxEventA}`}, '{}'::jsonb, 'PENDING'::"OutboxEventStatus", 0, NOW() + INTERVAL '90 days', NOW(), NOW()),
          (${outboxEventB}, ${orgB}, 'lead.stage_changed', 1, 'Lead', ${leadB}, ${`key-${outboxEventB}`}, '{}'::jsonb, 'PENDING'::"OutboxEventStatus", 0, NOW() + INTERVAL '90 days', NOW(), NOW())
      `;
      await tx.$executeRaw`
        INSERT INTO "SavedView"
          (id, "organizationId", "ownerId", name, visibility, "resourceType", definition, "createdAt", "updatedAt")
        VALUES
          (${savedViewA}, ${orgA}, ${userA}, 'Vista A', 'PRIVATE'::"SavedViewVisibility", 'LEAD'::"SavedViewResourceType", '{"hasWebsite":false}'::jsonb, NOW(), NOW()),
          (${savedViewB}, ${orgB}, ${userB}, 'Vista B', 'TEAM'::"SavedViewVisibility", 'LEAD'::"SavedViewResourceType", '{"status":"NEW"}'::jsonb, NOW(), NOW())
      `;
      await tx.$executeRaw`
        INSERT INTO "Workflow"
          (id, "organizationId", "ownerId", name, status, "draftDefinition", "createdAt", "updatedAt")
        VALUES
          (${workflowA}, ${orgA}, ${userA}, 'Fluxo A', 'DRAFT'::"WorkflowStatus", '{"trigger":{"type":"lead.created"},"steps":[]}'::jsonb, NOW(), NOW()),
          (${workflowB}, ${orgB}, ${userB}, 'Fluxo B', 'DRAFT'::"WorkflowStatus", '{"trigger":{"type":"lead.created"},"steps":[]}'::jsonb, NOW(), NOW())
      `;
      await tx.$executeRaw`
        INSERT INTO "WorkflowVersion"
          (id, "organizationId", "workflowId", version, definition, "publishedAt", "createdAt")
        VALUES
          (${workflowVersionA}, ${orgA}, ${workflowA}, 1, '{"trigger":{"type":"lead.created"},"steps":[{"type":"add_tag","tagName":"a"}]}'::jsonb, NOW(), NOW()),
          (${workflowVersionB}, ${orgB}, ${workflowB}, 1, '{"trigger":{"type":"lead.created"},"steps":[{"type":"add_tag","tagName":"b"}]}'::jsonb, NOW(), NOW())
      `;
      await tx.$executeRaw`
        INSERT INTO "WorkflowStepRun"
          (id, "organizationId", "workflowId", "workflowVersionId", "eventId", "leadId", "stepIndex", outcome, "createdAt")
        VALUES
          (${workflowStepRunA}, ${orgA}, ${workflowA}, ${workflowVersionA}, ${outboxEventA}, ${leadA}, 0, 'APPLIED'::"WorkflowStepRunOutcome", NOW()),
          (${workflowStepRunB}, ${orgB}, ${workflowB}, ${workflowVersionB}, ${outboxEventB}, ${leadB}, 0, 'SKIPPED'::"WorkflowStepRunOutcome", NOW())
      `;
      await tx.$executeRaw`
        INSERT INTO "CustomFieldDefinition"
          (id, "organizationId", name, type, position, options, "createdAt", "updatedAt")
        VALUES
          (${customFieldA}, ${orgA}, 'NIF A', 'TEXT'::"CustomFieldType", 0, '[]'::jsonb, NOW(), NOW()),
          (${customFieldB}, ${orgB}, 'NIF B', 'TEXT'::"CustomFieldType", 0, '[]'::jsonb, NOW(), NOW())
      `;
      await tx.$executeRaw`
        INSERT INTO "GoogleConnection"
          (id, "organizationId", "userId", "googleSubject", "googleEmail", "refreshTokenEncrypted", scopes, "connectedAt", "createdAt", "updatedAt")
        VALUES
          (${googleConnectionA}, ${orgA}, ${userA}, 'sub-a', 'a@gmail.test', 'cipher-a', 'gmail.readonly', NOW(), NOW(), NOW()),
          (${googleConnectionB}, ${orgB}, ${userB}, 'sub-b', 'b@gmail.test', 'cipher-b', 'gmail.readonly', NOW(), NOW(), NOW())
      `;
    });
  });

  afterAll(async () => {
    if (!prisma) return;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'on', true)`;
      await tx.$executeRawUnsafe(
        `DELETE FROM "GoogleConnection" WHERE "organizationId" IN ($1, $2)`,
        orgA,
        orgB,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM "CustomFieldDefinition" WHERE "organizationId" IN ($1, $2)`,
        orgA,
        orgB,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM "WorkflowStepRun" WHERE "organizationId" IN ($1, $2)`,
        orgA,
        orgB,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM "WorkflowVersion" WHERE "organizationId" IN ($1, $2)`,
        orgA,
        orgB,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM "Workflow" WHERE "organizationId" IN ($1, $2)`,
        orgA,
        orgB,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM "SavedView" WHERE "organizationId" IN ($1, $2)`,
        orgA,
        orgB,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM "OrganizationMember" WHERE id IN ($1, $2)`,
        memberAOrgA,
        memberBOrgB,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM "Lead" WHERE "organizationId" IN ($1, $2)`,
        orgA,
        orgB,
      );
      await tx.$executeRawUnsafe(`DELETE FROM "User" WHERE id IN ($1, $2)`, userA, userB);
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

  it('isolates monthly checkout attempts by organization', async () => {
    const rows = await prisma!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL ROLE prospectly_app`;
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgA}, true), set_config('app.current_user_id', '', true), set_config('app.rls_bypass', '', true)`;
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "MonthlyCheckoutAttempt" ORDER BY id
      `;
    });

    expect(rows).toEqual([{ id: checkoutAttemptA }]);
  });

  it('isolates billing profiles by organization', async () => {
    const rows = await prisma!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL ROLE prospectly_app`;
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgA}, true), set_config('app.current_user_id', '', true), set_config('app.rls_bypass', '', true)`;
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "BillingProfile" ORDER BY id
      `;
    });

    expect(rows).toEqual([{ id: billingProfileA }]);
  });

  it('isolates saved views by organization', async () => {
    const rows = await prisma!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL ROLE prospectly_app`;
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgA}, true), set_config('app.current_user_id', '', true), set_config('app.rls_bypass', '', true)`;
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "SavedView" ORDER BY id
      `;
    });

    expect(rows).toEqual([{ id: savedViewA }]);
  });

  it('rejects a cross-tenant saved view insert', async () => {
    const foreignViewId = randomUUID();

    await expect(
      prisma!.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL ROLE prospectly_app`;
        await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgA}, true), set_config('app.current_user_id', '', true), set_config('app.rls_bypass', '', true)`;
        await tx.$executeRaw`
          INSERT INTO "SavedView"
            (id, "organizationId", "ownerId", name, visibility, "resourceType", definition, "createdAt", "updatedAt")
          VALUES
            (${foreignViewId}, ${orgB}, ${userB}, 'Leaked', 'PRIVATE'::"SavedViewVisibility", 'LEAD'::"SavedViewResourceType", '{}'::jsonb, NOW(), NOW())
        `;
      }),
    ).rejects.toThrow();
  });

  it('isolates workflows by organization', async () => {
    const rows = await prisma!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL ROLE prospectly_app`;
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgA}, true), set_config('app.current_user_id', '', true), set_config('app.rls_bypass', '', true)`;
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Workflow" ORDER BY id
      `;
    });

    expect(rows).toEqual([{ id: workflowA }]);
  });

  it('rejects a cross-tenant workflow insert', async () => {
    const foreignWorkflowId = randomUUID();

    await expect(
      prisma!.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL ROLE prospectly_app`;
        await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgA}, true), set_config('app.current_user_id', '', true), set_config('app.rls_bypass', '', true)`;
        await tx.$executeRaw`
          INSERT INTO "Workflow"
            (id, "organizationId", "ownerId", name, status, "draftDefinition", "createdAt", "updatedAt")
          VALUES
            (${foreignWorkflowId}, ${orgB}, ${userB}, 'Leaked', 'DRAFT'::"WorkflowStatus", '{}'::jsonb, NOW(), NOW())
        `;
      }),
    ).rejects.toThrow();
  });

  it('isolates workflow versions by organization', async () => {
    const rows = await prisma!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL ROLE prospectly_app`;
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgA}, true), set_config('app.current_user_id', '', true), set_config('app.rls_bypass', '', true)`;
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "WorkflowVersion" ORDER BY id
      `;
    });

    expect(rows).toEqual([{ id: workflowVersionA }]);
  });

  it('rejects a cross-tenant workflow version insert', async () => {
    const foreignVersionId = randomUUID();

    await expect(
      prisma!.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL ROLE prospectly_app`;
        await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgA}, true), set_config('app.current_user_id', '', true), set_config('app.rls_bypass', '', true)`;
        await tx.$executeRaw`
          INSERT INTO "WorkflowVersion"
            (id, "organizationId", "workflowId", version, definition, "publishedAt", "createdAt")
          VALUES
            (${foreignVersionId}, ${orgB}, ${workflowB}, 2, '{}'::jsonb, NOW(), NOW())
        `;
      }),
    ).rejects.toThrow();
  });

  it('isolates workflow step runs by organization', async () => {
    const rows = await prisma!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL ROLE prospectly_app`;
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgA}, true), set_config('app.current_user_id', '', true), set_config('app.rls_bypass', '', true)`;
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "WorkflowStepRun" ORDER BY id
      `;
    });

    expect(rows).toEqual([{ id: workflowStepRunA }]);
  });

  it('rejects a cross-tenant workflow step run insert', async () => {
    const foreignRunId = randomUUID();

    await expect(
      prisma!.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL ROLE prospectly_app`;
        await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgA}, true), set_config('app.current_user_id', '', true), set_config('app.rls_bypass', '', true)`;
        await tx.$executeRaw`
          INSERT INTO "WorkflowStepRun"
            (id, "organizationId", "workflowId", "workflowVersionId", "eventId", "leadId", "stepIndex", outcome, "createdAt")
          VALUES
            (${foreignRunId}, ${orgB}, ${workflowB}, ${workflowVersionB}, ${outboxEventB}, ${leadB}, 1, 'APPLIED'::"WorkflowStepRunOutcome", NOW())
        `;
      }),
    ).rejects.toThrow();
  });

  it('isolates custom field definitions by organization', async () => {
    const rows = await prisma!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL ROLE prospectly_app`;
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgA}, true), set_config('app.current_user_id', '', true), set_config('app.rls_bypass', '', true)`;
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "CustomFieldDefinition" ORDER BY id
      `;
    });

    expect(rows).toEqual([{ id: customFieldA }]);
  });

  it('isolates google connections by organization', async () => {
    const rows = await prisma!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL ROLE prospectly_app`;
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgA}, true), set_config('app.current_user_id', '', true), set_config('app.rls_bypass', '', true)`;
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "GoogleConnection" ORDER BY id
      `;
    });

    expect(rows).toEqual([{ id: googleConnectionA }]);
  });

  it('rejects a cross-tenant google connection insert', async () => {
    const foreignConnectionId = randomUUID();

    await expect(
      prisma!.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL ROLE prospectly_app`;
        await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgA}, true), set_config('app.current_user_id', '', true), set_config('app.rls_bypass', '', true)`;
        await tx.$executeRaw`
          INSERT INTO "GoogleConnection"
            (id, "organizationId", "userId", "googleSubject", "googleEmail", scopes, "createdAt", "updatedAt")
          VALUES
            (${foreignConnectionId}, ${orgB}, ${userA}, 'sub-leak', 'leak@gmail.test', 'gmail.readonly', NOW(), NOW())
        `;
      }),
    ).rejects.toThrow();
  });

  it('rejects a cross-tenant custom field insert', async () => {
    const foreignFieldId = randomUUID();

    await expect(
      prisma!.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL ROLE prospectly_app`;
        await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgA}, true), set_config('app.current_user_id', '', true), set_config('app.rls_bypass', '', true)`;
        await tx.$executeRaw`
          INSERT INTO "CustomFieldDefinition"
            (id, "organizationId", name, type, position, options, "createdAt", "updatedAt")
          VALUES
            (${foreignFieldId}, ${orgB}, 'Leaked', 'TEXT'::"CustomFieldType", 1, '[]'::jsonb, NOW(), NOW())
        `;
      }),
    ).rejects.toThrow();
  });

  it('isolates outbox events by organization', async () => {
    const rows = await prisma!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL ROLE prospectly_app`;
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgA}, true), set_config('app.current_user_id', '', true), set_config('app.rls_bypass', '', true)`;
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "OutboxEvent" ORDER BY id
      `;
    });

    expect(rows).toEqual([{ id: outboxEventA }]);
  });

  it('rejects a cross-tenant outbox insert', async () => {
    const foreignEventId = randomUUID();

    await expect(
      prisma!.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL ROLE prospectly_app`;
        await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgA}, true), set_config('app.current_user_id', '', true), set_config('app.rls_bypass', '', true)`;
        await tx.$executeRaw`
          INSERT INTO "OutboxEvent"
            (id, "organizationId", type, "schemaVersion", "aggregateType", "aggregateId", "idempotencyKey", payload, status, attempts, "retainUntil", "createdAt", "updatedAt")
          VALUES
            (${foreignEventId}, ${orgB}, 'lead.stage_changed', 1, 'Lead', ${leadB}, ${`key-${foreignEventId}`}, '{}'::jsonb, 'PENDING'::"OutboxEventStatus", 0, NOW() + INTERVAL '90 days', NOW(), NOW())
        `;
      }),
    ).rejects.toThrow();
  });

  it('rolls back a lead write and outbox insert together', async () => {
    const rolledBackEventId = randomUUID();

    await expect(
      prisma!.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'on', true)`;
        await tx.$executeRaw`UPDATE "Lead" SET "companyName" = 'Moved then rolled back' WHERE id = ${leadA}`;
        await tx.$executeRaw`
          INSERT INTO "OutboxEvent"
            (id, "organizationId", type, "schemaVersion", "aggregateType", "aggregateId", "idempotencyKey", payload, status, attempts, "retainUntil", "createdAt", "updatedAt")
          VALUES
            (${rolledBackEventId}, ${orgA}, 'lead.stage_changed', 1, 'Lead', ${leadA}, ${`key-${rolledBackEventId}`}, '{}'::jsonb, 'PENDING'::"OutboxEventStatus", 0, NOW() + INTERVAL '90 days', NOW(), NOW())
        `;
        throw new Error('forced rollback');
      }),
    ).rejects.toThrow('forced rollback');

    const lead = await prisma!.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'on', true)`;
      return tx.$queryRaw<Array<{ companyName: string }>>`
        SELECT "companyName" FROM "Lead" WHERE id = ${leadA}
      `;
    });
    const events = await prisma!.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'on', true)`;
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "OutboxEvent" WHERE id = ${rolledBackEventId}
      `;
    });

    expect(lead).toEqual([{ companyName: 'Lead A' }]);
    expect(events).toEqual([]);
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
    await prisma!.$executeRawUnsafe(`ALTER ROLE prospectly_app LOGIN PASSWORD '${password}'`);

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

      const tenantRawRows = await runWithTenant(
        orgA,
        () => runtimePrisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Lead" ORDER BY id`,
      );
      expect(tenantRawRows).toEqual([{ id: leadA }]);

      const ownerMembers = await prisma!.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'on', true)`;
        return tx.$queryRaw<Array<{ id: string; userId: string; organizationId: string }>>`
          SELECT id, "userId", "organizationId" FROM "OrganizationMember" ORDER BY id
        `;
      });
      expect(ownerMembers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: memberAOrgA, userId: userA, organizationId: orgA }),
        ]),
      );

      const roleMembers = await prisma!.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL ROLE prospectly_app`;
        await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgA}, true), set_config('app.current_user_id', ${userA}, true), set_config('app.rls_bypass', '', true)`;
        return tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "OrganizationMember" ORDER BY id
        `;
      });
      expect(roleMembers).toEqual([{ id: memberAOrgA }]);

      const membershipsViaBypass = await runWithBypass(() =>
        runtimePrisma.organizationMember.findMany({
          select: { id: true, userId: true, organizationId: true, role: true },
          orderBy: { createdAt: 'asc' },
        }),
      );
      expect(membershipsViaBypass).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: memberAOrgA, userId: userA, organizationId: orgA }),
        ]),
      );

      const membershipsViaTenant = await runWithTenant(
        orgA,
        () =>
          runtimePrisma.organizationMember.findMany({
            where: { userId: userA, organizationId: orgA },
          }),
        userA,
      );
      expect(membershipsViaTenant.map((row) => row.id)).toEqual([memberAOrgA]);

      const membership = await runWithTenant(
        orgA,
        () =>
          runtimePrisma.organizationMember.findUnique({
            where: { userId_organizationId: { userId: userA, organizationId: orgA } },
          }),
        userA,
      );
      expect(membership?.id).toBe(memberAOrgA);

      const foreignMembership = await runWithTenant(
        orgA,
        () =>
          runtimePrisma.organizationMember.findUnique({
            where: { userId_organizationId: { userId: userB, organizationId: orgB } },
          }),
        userA,
      );
      expect(foreignMembership).toBeNull();

      const otherUserMembership = await runWithTenant(
        orgB,
        () =>
          runtimePrisma.organizationMember.findUnique({
            where: { userId_organizationId: { userId: userA, organizationId: orgA } },
          }),
        userB,
      );
      expect(otherUserMembership).toBeNull();

      const strategy = new JwtStrategy(
        { getOrThrow: () => 'access-secret-min-32-characters!!' } as unknown as ConfigService,
        runtimePrisma as unknown as PrismaService,
      );
      await expect(
        strategy.validate({
          sub: userA,
          email: 'rls-a@example.test',
          orgId: orgA,
          role: 'MEMBER',
        }),
      ).resolves.toMatchObject({
        id: userA,
        organizationId: orgA,
        role: 'OWNER',
      });

      await expect(
        strategy.validate({
          sub: userA,
          email: 'rls-a@example.test',
          orgId: orgB,
          role: 'OWNER',
        }),
      ).rejects.toThrow(UnauthorizedException);

      await runWithBypass(() =>
        runtimePrisma.organizationMember.delete({ where: { id: memberAOrgA } }),
      );

      await expect(
        strategy.validate({
          sub: userA,
          email: 'rls-a@example.test',
          orgId: orgA,
          role: 'OWNER',
        }),
      ).rejects.toThrow('Membership revoked');
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
