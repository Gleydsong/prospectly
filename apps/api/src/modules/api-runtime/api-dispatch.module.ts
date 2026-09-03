import { Module } from '@nestjs/common';

import { ImportsModule } from '../imports/imports.module';
import { ImportsService } from '../imports/imports.service';
import { ImportsDispatchReconciler } from '../imports/imports-dispatch.reconciler';
import { OpportunityFinderModule } from '../opportunity-finder/opportunity-finder.module';
import { OpportunityFinderService } from '../opportunity-finder/opportunity-finder.service';
import { OpportunityFinderDispatchReconciler } from '../opportunity-finder/opportunity-finder-dispatch.reconciler';
import { ProspectingModule } from '../prospecting/prospecting.module';
import { ProspectingService } from '../prospecting/prospecting.service';
import { ProspectingDispatchReconciler } from '../prospecting/prospecting-dispatch.reconciler';
import { WebsiteAnalysisModule } from '../website-analysis/website-analysis.module';
import { WebsiteAnalysisService } from '../website-analysis/website-analysis.service';
import { WebsiteAnalysisDispatchReconciler } from '../website-analysis/website-analysis-dispatch.reconciler';

@Module({
  imports: [ProspectingModule, ImportsModule, WebsiteAnalysisModule, OpportunityFinderModule],
  providers: [
    {
      provide: ProspectingDispatchReconciler,
      inject: [ProspectingService],
      useFactory: (service: ProspectingService) => new ProspectingDispatchReconciler(service),
    },
    {
      provide: ImportsDispatchReconciler,
      inject: [ImportsService],
      useFactory: (service: ImportsService) => new ImportsDispatchReconciler(service),
    },
    {
      provide: WebsiteAnalysisDispatchReconciler,
      inject: [WebsiteAnalysisService],
      useFactory: (service: WebsiteAnalysisService) =>
        new WebsiteAnalysisDispatchReconciler(service),
    },
    {
      provide: OpportunityFinderDispatchReconciler,
      inject: [OpportunityFinderService],
      useFactory: (service: OpportunityFinderService) =>
        new OpportunityFinderDispatchReconciler(service),
    },
  ],
})
export class ApiDispatchModule {}
