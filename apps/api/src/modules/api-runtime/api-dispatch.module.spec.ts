import { MODULE_METADATA } from '@nestjs/common/constants';

import { ImportsDispatchReconciler } from '../imports/imports-dispatch.reconciler';
import { ImportsModule } from '../imports/imports.module';
import { OpportunityFinderDispatchReconciler } from '../opportunity-finder/opportunity-finder-dispatch.reconciler';
import { OpportunityFinderModule } from '../opportunity-finder/opportunity-finder.module';
import { ProspectingDispatchReconciler } from '../prospecting/prospecting-dispatch.reconciler';
import { ProspectingModule } from '../prospecting/prospecting.module';
import { WebsiteAnalysisDispatchReconciler } from '../website-analysis/website-analysis-dispatch.reconciler';
import { WebsiteAnalysisModule } from '../website-analysis/website-analysis.module';
import { ApiDispatchModule } from './api-dispatch.module';

function providerTokens(mod: object): unknown[] {
  const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, mod) as unknown[]) ?? [];
  return providers.map((provider) =>
    provider && typeof provider === 'object' && 'provide' in provider
      ? (provider as { provide: unknown }).provide
      : provider,
  );
}

describe('API-only dispatch reconcilers', () => {
  it.each([
    ['ProspectingModule', ProspectingModule, ProspectingDispatchReconciler],
    ['ImportsModule', ImportsModule, ImportsDispatchReconciler],
    ['WebsiteAnalysisModule', WebsiteAnalysisModule, WebsiteAnalysisDispatchReconciler],
    ['OpportunityFinderModule', OpportunityFinderModule, OpportunityFinderDispatchReconciler],
  ] as const)('%s does not start its reconciler', (_name, mod, reconciler) => {
    expect(providerTokens(mod)).not.toContain(reconciler);
  });

  it('registers every dispatch reconciler on the API composition module', () => {
    const tokens = providerTokens(ApiDispatchModule);
    expect(tokens).toEqual(
      expect.arrayContaining([
        ProspectingDispatchReconciler,
        ImportsDispatchReconciler,
        WebsiteAnalysisDispatchReconciler,
        OpportunityFinderDispatchReconciler,
      ]),
    );
    expect(tokens).toHaveLength(4);
  });
});
