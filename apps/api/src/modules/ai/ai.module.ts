import { Module } from '@nestjs/common';

import { StructuredAiService } from './structured-ai.service';

@Module({
  providers: [StructuredAiService],
  exports: [StructuredAiService],
})
export class AiModule {}
