jest.mock('./config/validation', () => ({
  validateEnv: (config: Record<string, unknown>) => config,
}));

import { type DynamicModule, type ForwardReference, type Type } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';

import { WorkerModule } from './worker.module';
import { PrismaService } from './common/prisma/prisma.service';
import { ApiDispatchModule } from './modules/api-runtime/api-dispatch.module';
import { ImportsDispatchReconciler } from './modules/imports/imports-dispatch.reconciler';
import { OpportunityFinderDispatchReconciler } from './modules/opportunity-finder/opportunity-finder-dispatch.reconciler';
import { OutboxDispatchReconciler } from './modules/outbox/outbox-dispatch.reconciler';
import { ProspectingDispatchReconciler } from './modules/prospecting/prospecting-dispatch.reconciler';
import { WebsiteAnalysisDispatchReconciler } from './modules/website-analysis/website-analysis-dispatch.reconciler';
import { AsaasWebhookService } from './modules/billing/asaas-webhook.service';
import { BillingController } from './modules/billing/billing.controller';
import { BillingModule } from './modules/billing/billing.module';
import { PrivacyController } from './modules/privacy/privacy.controller';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { PrivacyRetentionModule } from './modules/privacy/privacy-retention.module';
import { PrivacyService } from './modules/privacy/privacy.service';
import { RetentionProcessor } from './modules/privacy/retention.processor';
import { RetentionScheduler } from './modules/privacy/retention.scheduler';
import { SuppressionModule } from './modules/privacy/suppression.module';
import { WorkersModule } from './modules/workers/workers.module';
import { ProspectingProcessor } from './modules/prospecting/prospecting.processor';
import { OutboxProcessor } from './modules/outbox/outbox.processor';

function collectTransitiveModules(
  root: Type<unknown> | DynamicModule | Promise<DynamicModule> | ForwardReference,
  visited = new Set<Type<unknown>>(),
): Set<Type<unknown>> {
  if (!root) return visited;
  let mod: Type<unknown> | undefined;
  if (typeof root === 'object' && root !== null) {
    if ('forwardRef' in root && typeof (root as ForwardReference).forwardRef === 'function') {
      mod = (root as ForwardReference).forwardRef() as Type<unknown>;
    } else if ('module' in root) {
      mod = (root as DynamicModule).module as Type<unknown>;
    }
  } else if (typeof root === 'function') {
    mod = root as Type<unknown>;
  }
  if (!mod || visited.has(mod)) return visited;
  visited.add(mod);

  const rawImports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, mod) as unknown[]) ?? [];
  for (const rawImport of rawImports) {
    collectTransitiveModules(
      rawImport as Type<unknown> | DynamicModule | Promise<DynamicModule> | ForwardReference,
      visited,
    );
  }
  return visited;
}

describe('WorkerModule', () => {
  const directImports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, WorkerModule) as unknown[];

  it('registers BullMQ processors and omits API-only schedulers and reconcilers in direct imports', () => {
    expect(directImports).toContain(WorkersModule);
    expect(directImports).not.toContain(PrivacyModule);
    expect(directImports).not.toContain(ApiDispatchModule);
    expect(directImports).not.toContain(BillingModule);
  });

  it('transitive import graph never reaches PrivacyModule, ApiDispatchModule, or BillingModule', () => {
    const transitive = collectTransitiveModules(WorkerModule);
    expect(transitive.has(WorkersModule)).toBe(true);
    expect(transitive.has(SuppressionModule)).toBe(true);
    expect(transitive.has(PrivacyRetentionModule)).toBe(true);

    expect(transitive.has(PrivacyModule)).toBe(false);
    expect(transitive.has(ApiDispatchModule)).toBe(false);
    expect(transitive.has(BillingModule)).toBe(false);
  });

  it('compiles WorkerModule real graph with mocked infrastructure and proves API-only providers are absent', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [WorkerModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $transaction: jest.fn(),
      })
      .compile();

    try {
      expect(moduleRef).toBeDefined();

      // Verify RetentionScheduler is absent
      expect(() => moduleRef.get(RetentionScheduler, { strict: false })).toThrow();

      // Verify PrivacyModule and API-only privacy providers are absent
      expect(() => moduleRef.get(PrivacyModule, { strict: false })).toThrow();
      expect(() => moduleRef.get(PrivacyController, { strict: false })).toThrow();
      expect(() => moduleRef.get(PrivacyService, { strict: false })).toThrow();

      // Verify API-only dispatch reconcilers and ApiDispatchModule are absent
      expect(() => moduleRef.get(ApiDispatchModule, { strict: false })).toThrow();
      expect(() => moduleRef.get(ProspectingDispatchReconciler, { strict: false })).toThrow();
      expect(() => moduleRef.get(ImportsDispatchReconciler, { strict: false })).toThrow();
      expect(() => moduleRef.get(WebsiteAnalysisDispatchReconciler, { strict: false })).toThrow();
      expect(() => moduleRef.get(OpportunityFinderDispatchReconciler, { strict: false })).toThrow();
      expect(() => moduleRef.get(OutboxDispatchReconciler, { strict: false })).toThrow();

      // Verify API-only billing providers are absent
      expect(() => moduleRef.get(BillingModule, { strict: false })).toThrow();
      expect(() => moduleRef.get(BillingController, { strict: false })).toThrow();
      expect(() => moduleRef.get(AsaasWebhookService, { strict: false })).toThrow();

      // Verify worker-required processors ARE present in the worker DI container
      expect(moduleRef.get(RetentionProcessor, { strict: false })).toBeInstanceOf(
        RetentionProcessor,
      );
      expect(moduleRef.get(ProspectingProcessor, { strict: false })).toBeInstanceOf(
        ProspectingProcessor,
      );
      expect(moduleRef.get(OutboxProcessor, { strict: false })).toBeInstanceOf(OutboxProcessor);
    } finally {
      await moduleRef.close();
    }
  });
});
