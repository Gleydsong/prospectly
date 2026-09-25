import { Module } from '@nestjs/common';

import { SdrRuntimeController } from './sdr-runtime.controller';
import { SdrRuntimeService } from './application/sdr-runtime.service';

@Module({
  controllers: [SdrRuntimeController],
  providers: [SdrRuntimeService],
})
export class SdrRuntimeModule {}
