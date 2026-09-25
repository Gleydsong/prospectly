import { Module } from '@nestjs/common';

import { OllamaChatClient } from '../agents/whatsapp-ai/ollama-chat.client';
import { SdrRuntimeController } from './sdr-runtime.controller';
import { SdrRuntimeService } from './application/sdr-runtime.service';

@Module({
  controllers: [SdrRuntimeController],
  providers: [SdrRuntimeService, OllamaChatClient],
})
export class SdrRuntimeModule {}
