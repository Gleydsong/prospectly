import { Module } from '@nestjs/common';

import { StructuredAiService } from './structured-ai.service';
import {
  LlmBudgetService,
  LlmProviderService,
  LlmTelemetryService,
  OpenAiCompatibleClient,
} from './llm-provider';

@Module({
  providers: [
    StructuredAiService,
    LlmBudgetService,
    LlmTelemetryService,
    OpenAiCompatibleClient,
    LlmProviderService,
  ],
  exports: [
    StructuredAiService,
    LlmBudgetService,
    LlmTelemetryService,
    OpenAiCompatibleClient,
    LlmProviderService,
  ],
})
export class AiModule {}
